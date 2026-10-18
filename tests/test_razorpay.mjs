import crypto from 'crypto';

const API_BASE = 'http://localhost:5000/api';
const RZP_SECRET = 'agrivafoods_rzp_secret_test_2026';
const RZP_WEBHOOK_SECRET = 'agrivafoods_rzp_webhook_secret_2026';

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTests() {
  console.log('========================================================');
  console.log('   AGRIVAFOODS RAZORPAY INTEGRATION TEST SUITE');
  console.log('========================================================\n');

  // Fetch available products to use in tests
  const prodRes = await fetch(`${API_BASE}/products`);
  const prodData = await prodRes.json();
  const moringa = prodData.data.find(p => p.slug === 'organic-moringa-powder') || prodData.data[0];
  const variant = moringa.variants[0]; // e.g. 100g, price: 149
  const originalStock = variant.stock;

  console.log(`Using test product: "${moringa.name}", Variant: ${variant.weight} (${variant.sku}), Price: ₹${variant.price}, Stock: ${originalStock}\n`);

  // TEST 1: Payment Config Endpoint
  console.log('Test 1: Payment Config Endpoint');
  {
    const res = await fetch(`${API_BASE}/payment/config`);
    const data = await res.json();
    assert(res.status === 200, 'Config returns 200 OK');
    assert(data.success === true, 'Response marked success');
    assert(data.data.currency === 'INR', 'Currency is INR');
    assert(data.data.keyId.length > 0, 'Public Razorpay Key ID is present');
  }

  // TEST 2: Price Tampering Prevention
  console.log('\nTest 2: Price Tampering Prevention (Never trust frontend price)');
  {
    const tamperedPayload = {
      customer: {
        fullName: 'Security Tester',
        email: 'tester@example.com',
        phone: '9876543210'
      },
      shippingAddress: {
        address: '123 Safe St',
        city: 'Bengaluru',
        state: 'Karnataka',
        pinCode: '560001'
      },
      items: [
        {
          id: moringa._id,
          sku: variant.sku,
          weight: variant.weight,
          name: moringa.name,
          quantity: 1,
          price: 1, // MALICIOUS: Tampered price
          subtotal: 1, // MALICIOUS: Tampered subtotal
          total: 1 // MALICIOUS: Tampered total
        }
      ],
      paymentMethod: 'Razorpay'
    };

    const res = await fetch(`${API_BASE}/payment/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tamperedPayload)
    });
    const data = await res.json();

    assert(res.status === 201, 'Order created successfully');
    assert(data.data.order.items[0].price === variant.price, `Item price overridden by DB price (₹${variant.price}), not client's ₹1`);
    assert(data.data.order.subtotal === variant.price, `Subtotal calculated authoritatively (₹${variant.price})`);
    
    // Order < 499 has ₹49 shipping
    const expectedTotal = variant.price + 49;
    assert(data.data.order.total === expectedTotal, `Total includes authoritative shipping (₹${expectedTotal})`);
    assert(data.data.razorpayOrder.amount === expectedTotal * 100, `Razorpay amount in paise matches trusted total (${expectedTotal * 100})`);
  }

  // TEST 3: Out of Stock Prevention
  console.log('\nTest 3: Out of Stock Prevention');
  {
    const excessiveQuantityPayload = {
      customer: {
        fullName: 'Greedy Buyer',
        email: 'greedy@example.com',
        phone: '9876543210'
      },
      shippingAddress: {
        address: '123 Safe St',
        city: 'Bengaluru',
        state: 'Karnataka',
        pinCode: '560001'
      },
      items: [
        {
          id: moringa._id,
          sku: variant.sku,
          quantity: 999999
        }
      ]
    };

    const res = await fetch(`${API_BASE}/payment/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(excessiveQuantityPayload)
    });
    const data = await res.json();

    assert(res.status === 400, 'Order rejected with 400 Bad Request');
    assert(data.success === false, 'Response marked false');
    assert(data.message.includes('Insufficient stock'), 'Error message clearly specifies insufficient stock');
  }

  // TEST 4 & 5: Valid Order Creation & Cryptographic Signature Verification
  console.log('\nTest 4 & 5: Order Creation & Valid Cryptographic Signature Verification');
  let validOrder = null;
  let rzpOrder = null;
  let stockBefore = 0;
  {
    // Check current stock
    const pRes = await fetch(`${API_BASE}/products/${moringa._id}`);
    const pData = await pRes.json();
    const v = pData.data.variants.find(item => item.sku === variant.sku);
    stockBefore = v.stock;

    const payload = {
      customer: {
        fullName: 'Jane Doe',
        email: 'jane@example.com',
        phone: '9876543210'
      },
      shippingAddress: {
        address: '456 Green Valley',
        apartment: 'Suite 2B',
        city: 'Pune',
        state: 'Maharashtra',
        pinCode: '411001'
      },
      items: [
        {
          id: moringa._id,
          sku: variant.sku,
          quantity: 2
        }
      ],
      paymentMethod: 'Razorpay'
    };

    const res = await fetch(`${API_BASE}/payment/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    validOrder = data.data.order;
    rzpOrder = data.data.razorpayOrder;

    assert(res.status === 201, 'Order created successfully');
    assert(validOrder.paymentStatus === 'Pending', 'Initial payment status is Pending');
    assert(validOrder.orderStatus === 'Pending', 'Initial order status is Pending');
    assert(validOrder.stockDeducted === false, 'Stock is not yet deducted while order is pending');
    assert(rzpOrder.id.startsWith('order_'), 'Razorpay order ID received');

    // Generate valid HMAC SHA256 signature
    const mockPaymentId = `pay_${Date.now()}_test`;
    const signaturePayload = `${rzpOrder.id}|${mockPaymentId}`;
    const validSignature = crypto
      .createHmac('sha256', RZP_SECRET)
      .update(signaturePayload)
      .digest('hex');

    // Verify payment
    const verifyRes = await fetch(`${API_BASE}/payment/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: validOrder._id,
        razorpayOrderId: rzpOrder.id,
        razorpayPaymentId: mockPaymentId,
        razorpaySignature: validSignature
      })
    });
    const verifyData = await verifyRes.json();

    assert(verifyRes.status === 200, 'Verification returns 200 OK');
    assert(verifyData.data.paymentStatus === 'Completed', 'Payment status updated to Completed');
    assert(verifyData.data.orderStatus === 'Processing', 'Order status transitioned to Processing');
    assert(verifyData.data.razorpayPaymentId === mockPaymentId, 'Razorpay Payment ID persisted');
    assert(verifyData.data.stockDeducted === true, 'stockDeducted flag set to true');

    // Check that variant stock was decremented by 2
    const pAfterRes = await fetch(`${API_BASE}/products/${moringa._id}`);
    const pAfterData = await pAfterRes.json();
    const vAfter = pAfterData.data.variants.find(item => item.sku === variant.sku);
    assert(vAfter.stock === stockBefore - 2, `Product stock decremented from ${stockBefore} to ${vAfter.stock}`);

    // TEST 6: Payment Verification Idempotency (Repeat exact same verification)
    console.log('\nTest 6: Idempotent Payment Verification (No duplicate stock deduction)');
    const repeatVerifyRes = await fetch(`${API_BASE}/payment/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: validOrder._id,
        razorpayOrderId: rzpOrder.id,
        razorpayPaymentId: mockPaymentId,
        razorpaySignature: validSignature
      })
    });
    const repeatVerifyData = await repeatVerifyRes.json();

    assert(repeatVerifyRes.status === 200, 'Repeat verification returns 200 OK without errors');
    assert(repeatVerifyData.data.paymentStatus === 'Completed', 'Payment status remains Completed');

    // Confirm stock was NOT decremented a second time
    const pRepeatRes = await fetch(`${API_BASE}/products/${moringa._id}`);
    const pRepeatData = await pRepeatRes.json();
    const vRepeat = pRepeatData.data.variants.find(item => item.sku === variant.sku);
    assert(vRepeat.stock === stockBefore - 2, `Stock unchanged on duplicate verification (still ${vRepeat.stock})`);
  }

  // TEST 7: Invalid Cryptographic Signature Rejection
  console.log('\nTest 7: Tampered Signature Rejection');
  {
    const payload = {
      customer: {
        fullName: 'Fraud Attempt',
        email: 'fraud@example.com',
        phone: '9876543210'
      },
      shippingAddress: {
        address: '123 Fake Rd',
        city: 'Delhi',
        state: 'Delhi',
        pinCode: '110001'
      },
      items: [
        {
          id: moringa._id,
          sku: variant.sku,
          quantity: 1
        }
      ],
      paymentMethod: 'Razorpay'
    };

    const res = await fetch(`${API_BASE}/payment/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    const fraudulentOrder = data.data.order;
    const fraudRzpOrder = data.data.razorpayOrder;

    const verifyRes = await fetch(`${API_BASE}/payment/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: fraudulentOrder._id,
        razorpayOrderId: fraudRzpOrder.id,
        razorpayPaymentId: 'pay_fraud_123',
        razorpaySignature: 'fraudulent_invalid_signature_hash_value'
      })
    });
    const verifyData = await verifyRes.json();

    assert(verifyRes.status === 400, 'Invalid signature rejected with 400 Bad Request');
    assert(verifyData.success === false, 'Verification response is false');
    assert(verifyData.message.includes('Invalid payment signature'), 'Error states Invalid payment signature');
  }

  // TEST 8 & 9: Webhook Handling & Duplicate Event Protection
  console.log('\nTest 8 & 9: Razorpay Webhook Handling & Duplicate Event Protection');
  {
    // 1. Create an order to be paid via webhook
    const pRes = await fetch(`${API_BASE}/products/${moringa._id}`);
    const pData = await pRes.json();
    const v = pData.data.variants.find(item => item.sku === variant.sku);
    const stockPreWebhook = v.stock;

    const payload = {
      customer: {
        fullName: 'Webhook Customer',
        email: 'webhook@example.com',
        phone: '9876543210'
      },
      shippingAddress: {
        address: '789 Webhook Ave',
        city: 'Hyderabad',
        state: 'Telangana',
        pinCode: '500001'
      },
      items: [
        {
          id: moringa._id,
          sku: variant.sku,
          quantity: 1
        }
      ],
      paymentMethod: 'Razorpay'
    };

    const res = await fetch(`${API_BASE}/payment/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    const webhookOrder = data.data.order;
    const webhookRzpOrder = data.data.razorpayOrder;

    // 2. Prepare mock webhook event: payment.captured
    const webhookEventId = `evt_${Date.now()}`;
    const webhookPaymentId = `pay_hook_${Date.now()}`;
    const webhookPayload = JSON.stringify({
      entity: 'event',
      account_id: 'acc_test123',
      event: 'payment.captured',
      contains: ['payment'],
      payload: {
        payment: {
          entity: {
            id: webhookPaymentId,
            order_id: webhookRzpOrder.id,
            amount: webhookRzpOrder.amount,
            status: 'captured'
          }
        }
      },
      id: webhookEventId,
      created_at: Math.floor(Date.now() / 1000)
    });

    const validWebhookSignature = crypto
      .createHmac('sha256', RZP_WEBHOOK_SECRET)
      .update(webhookPayload)
      .digest('hex');

    // 3. Post webhook to backend
    const hookRes = await fetch(`${API_BASE}/payment/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Razorpay-Signature': validWebhookSignature
      },
      body: webhookPayload
    });
    const hookData = await hookRes.json();

    assert(hookRes.status === 200, 'Webhook returns 200 OK');
    assert(hookData.result.status === 'processed', 'Webhook marked event processed');

    // Verify stock decremented by 1
    const pPostRes = await fetch(`${API_BASE}/products/${moringa._id}`);
    const pPostData = await pPostRes.json();
    const vPost = pPostData.data.variants.find(item => item.sku === variant.sku);
    assert(vPost.stock === stockPreWebhook - 1, `Stock decremented by webhook from ${stockPreWebhook} to ${vPost.stock}`);

    // TEST 9: Duplicate Webhook Event Protection
    console.log('\nTest 9: Re-transmitting same webhook event (Duplicate Protection)');
    const dupRes = await fetch(`${API_BASE}/payment/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Razorpay-Signature': validWebhookSignature
      },
      body: webhookPayload
    });
    const dupData = await dupRes.json();

    assert(dupRes.status === 200, 'Duplicate webhook returns 200 OK');
    assert(dupData.result.status === 'already_processed', 'Duplicate webhook detected as already_processed');

    // Verify stock NOT decremented a second time
    const pDupRes = await fetch(`${API_BASE}/products/${moringa._id}`);
    const pDupData = await pDupRes.json();
    const vDup = pDupData.data.variants.find(item => item.sku === variant.sku);
    assert(vDup.stock === stockPreWebhook - 1, `Stock remained unchanged on duplicate webhook (${vDup.stock})`);
  }

  // TEST 10: Webhook with Invalid Signature
  console.log('\nTest 10: Webhook with Invalid Signature Rejection');
  {
    const bogusPayload = JSON.stringify({ event: 'payment.captured', id: 'fake_123' });
    const hookRes = await fetch(`${API_BASE}/payment/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Razorpay-Signature': 'bogus_tampered_signature'
      },
      body: bogusPayload
    });
    const hookData = await hookRes.json();

    assert(hookRes.status === 400, 'Webhook with bad signature returns 400 Bad Request');
    assert(hookData.success === false, 'Rejected due to invalid signature');
  }

  console.log('\n========================================================');
  console.log(`   ALL TESTS PASSED: ${passedTests} / ${totalTests}`);
  console.log('========================================================\n');
}

runTests().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
