import { emailService, escapeHtml, formatINR } from '../src/services/emailService.js';
import { ProductService } from '../src/services/productService.js';
import { AuthService } from '../src/services/authService.js';
import { OrderService } from '../src/services/orderService.js';
import { PaymentService } from '../src/services/paymentService.js';
import { ContactService } from '../src/services/contactService.js';
import { env } from '../src/config/env.js';

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

async function runTestSuite() {
  console.log('================================================================');
  console.log('   AGRIVAFOODS ADMIN EMAIL NOTIFICATIONS TEST SUITE');
  console.log('================================================================\n');

  emailService.clearSentEmails();

  // TEST 1: Service Configuration & Verification
  console.log('--- TEST 1: Email Configuration & Transporter Status ---');
  {
    const connection = await emailService.verifyConnection();
    assert(connection !== null, 'Connection verification returned a result');
    assert(connection.status === 'mock_mode' || connection.status === 'connected', 'Status is mock_mode or connected');
    assert(typeof env.ADMIN_NOTIFICATION_EMAIL === 'string', 'Admin email configured');
    assert(env.ADMIN_NOTIFICATION_EMAIL.includes('@'), 'Admin email is a valid email format');
  }

  // TEST 2: HTML Sanitization & Helper Functions
  console.log('\n--- TEST 2: HTML Sanitization & Formatting Helpers ---');
  {
    const maliciousInput = '<script>alert("hack")</script>&"\'';
    const escaped = escapeHtml(maliciousInput);
    assert(!escaped.includes('<script>'), 'Script tag escaped');
    assert(escaped.includes('&lt;script&gt;'), 'Angle brackets converted to HTML entities');
    assert(escaped.includes('&quot;'), 'Quotes converted to HTML entities');
    assert(escaped.includes('&#039;'), 'Apostrophe converted to HTML entities');

    assert(formatINR(149) === '₹149', 'formatINR formats correctly');
    assert(formatINR(1000) === '₹1,000', 'formatINR formats thousands with comma');
  }

  // TEST 3: Product Added Notification
  console.log('\n--- TEST 3: Product Created Notification ---');
  {
    emailService.clearSentEmails();
    const testProduct = await ProductService.createProduct({
      name: `Test Organic Flaxseed ${Date.now()}`,
      category: 'Superfoods',
      description: 'Pure high-fiber organic cold-milled golden flaxseeds.',
      variants: [
        { weight: '250g', price: 180, originalPrice: 220, stock: 45, sku: `FLAX-250-${Date.now()}` },
        { weight: '500g', price: 340, originalPrice: 400, stock: 30, sku: `FLAX-500-${Date.now()}` }
      ]
    });

    const lastEmail = emailService.getLastSentEmail();
    assert(lastEmail !== null, 'Product created notification was triggered');
    assert(lastEmail.subject.includes('[AgrivaFoods Admin] New Product Created'), 'Subject line is correctly prefixed');
    assert(lastEmail.subject.includes(testProduct.name), 'Subject line contains product name');
    assert(lastEmail.html.includes(testProduct.name), 'HTML body includes product name');
    assert(lastEmail.html.includes('250g'), 'HTML body includes variant 250g');
    assert(lastEmail.html.includes('₹180'), 'HTML body includes variant price');
    assert(lastEmail.html.includes(testProduct._id || testProduct.id), 'HTML body includes product ID');
    assert(lastEmail.text.length > 50, 'Plain text fallback is present');
  }

  // TEST 4: Product Updated Notification (Diffing)
  console.log('\n--- TEST 4: Product Updated Notification (Diffing notable fields) ---');
  {
    // Create product to update
    const prod = await ProductService.createProduct({
      name: `Moringa Leaf Powder Test ${Date.now()}`,
      category: 'Superfoods',
      status: 'draft',
      variants: [
        { weight: '100g', price: 120, stock: 50, sku: `MOR-100-${Date.now()}` }
      ]
    });

    emailService.clearSentEmails();

    // Perform notable update: change price, stock, and publish
    await ProductService.updateProduct(prod._id || prod.id, {
      status: 'published',
      variants: [
        { weight: '100g', price: 149, stock: 40, sku: prod.variants[0].sku }
      ]
    });

    const lastEmail = emailService.getLastSentEmail();
    assert(lastEmail !== null, 'Product updated notification was sent');
    assert(lastEmail.subject.includes('[AgrivaFoods Admin] Product Updated'), 'Subject has Product Updated tag');
    assert(lastEmail.html.includes('draft'), 'HTML includes previous status (draft)');
    assert(lastEmail.html.includes('published'), 'HTML includes updated status (published)');
    assert(lastEmail.html.includes('₹120'), 'HTML includes previous price');
    assert(lastEmail.html.includes('₹149'), 'HTML includes new price');

    // Test that an update with NO changes does NOT trigger duplicate email
    emailService.clearSentEmails();
    await ProductService.updateProduct(prod._id || prod.id, {});
    assert(emailService.getSentEmails().length === 0, 'No email sent when no notable changes occur');
  }

  // TEST 5: New Customer Registration Notification
  console.log('\n--- TEST 5: New Customer Registration Notification ---');
  {
    emailService.clearSentEmails();
    const testEmail = `cust_${Date.now()}@example.com`;
    const regResult = await AuthService.register({
      name: 'Priya Sharma',
      email: testEmail,
      password: 'SecurePassword123!',
      phone: '9876543210'
    });

    assert(regResult.user !== null, 'User registered successfully');

    const lastEmail = emailService.getLastSentEmail();
    assert(lastEmail !== null, 'Registration email notification was sent');
    assert(lastEmail.subject.includes('[AgrivaFoods Admin] New Customer Registration'), 'Subject line is correctly prefixed');
    assert(lastEmail.subject.includes('Priya Sharma'), 'Subject contains customer name');
    assert(lastEmail.html.includes(testEmail), 'HTML body includes customer email');
    assert(lastEmail.html.includes('9876543210'), 'HTML body includes customer phone');

    // Security check: NEVER leak password or hash!
    assert(!lastEmail.html.includes('SecurePassword123!'), 'Plain password is NEVER included in email');
    assert(!lastEmail.text.includes('SecurePassword123!'), 'Plain password is NEVER in plain text email');
    assert(!lastEmail.html.includes('$2a$'), 'Bcrypt password hash is NEVER included in email');
  }

  // TEST 6: New Order Placed Notification (COD & Online Checkout)
  console.log('\n--- TEST 6: New Order Placed Notification ---');
  {
    emailService.clearSentEmails();

    const orderPayload = {
      customer: {
        fullName: 'Aarav Patel',
        email: 'aarav.patel@example.com',
        phone: '9988776655'
      },
      shippingAddress: {
        address: 'Flat 402, Green Orchid Apartments',
        apartment: 'Block B',
        city: 'Pune',
        state: 'Maharashtra',
        pinCode: '411038',
        country: 'India'
      },
      paymentMethod: 'COD',
      items: [
        {
          slug: 'organic-moringa-powder',
          name: 'Organic Moringa Powder',
          weight: '100g',
          quantity: 2
        }
      ]
    };

    const orderResult = await PaymentService.createOrderWithRazorpay(orderPayload);
    const order = orderResult.order;
    assert(order !== null, 'Order created successfully');
    assert(order.orderNumber.startsWith('AGR-'), 'Order has AGR order number');

    const lastEmail = emailService.getLastSentEmail();
    assert(lastEmail !== null, 'Order placement email was sent');
    assert(lastEmail.subject.includes('[AgrivaFoods Admin] New Order Placed'), 'Subject is New Order Placed');
    assert(lastEmail.subject.includes(order.orderNumber), 'Subject contains order number');
    assert(lastEmail.html.includes('Aarav Patel'), 'HTML contains customer name');
    assert(lastEmail.html.includes('aarav.patel@example.com'), 'HTML contains customer email');
    assert(lastEmail.html.includes('Flat 402, Green Orchid Apartments'), 'HTML contains delivery address');
    assert(lastEmail.html.includes('Pune, Maharashtra, 411038'), 'HTML contains city, state, pin');
    assert(lastEmail.html.includes(order.items[0].name), 'HTML contains product item name');
  }

  // TEST 7: Payment Verified Notification
  console.log('\n--- TEST 7: Payment Verified Notification ---');
  let test7RzpOrderId = '';
  {
    // Create an order awaiting payment
    const orderResult = await PaymentService.createOrderWithRazorpay({
      customer: {
        fullName: 'Meera Iyer',
        email: 'meera.iyer@example.com',
        phone: '9123456789'
      },
      shippingAddress: {
        address: '12 Temple Road',
        city: 'Chennai',
        state: 'Tamil Nadu',
        pinCode: '600001'
      },
      paymentMethod: 'Razorpay',
      items: [
        {
          slug: 'organic-moringa-powder',
          name: 'Organic Moringa Powder',
          weight: '100g',
          quantity: 1
        }
      ]
    });

    test7RzpOrderId = orderResult.razorpayOrder.id;
    emailService.clearSentEmails();

    // Verify payment with valid mock signature
    const verifiedOrder = await PaymentService.verifyPaymentAndCompleteOrder({
      orderId: orderResult.order._id,
      razorpayOrderId: test7RzpOrderId,
      razorpayPaymentId: 'pay_test_meera_789456',
      razorpaySignature: 'test_mock_signature'
    });

    assert(verifiedOrder.paymentStatus === 'Completed', 'Order marked Completed');

    const lastEmail = emailService.getLastSentEmail();
    assert(lastEmail !== null, 'Payment verified notification was sent');
    assert(lastEmail.subject.includes('[AgrivaFoods Admin] Payment Verified'), 'Subject includes Payment Verified');
    assert(lastEmail.subject.includes(verifiedOrder.orderNumber), 'Subject includes order reference');
    assert(lastEmail.html.includes('pay_test_meera_789456'), 'HTML contains Razorpay Payment ID');
    assert(lastEmail.html.includes(test7RzpOrderId), 'HTML contains Razorpay Order ID');
    assert(lastEmail.html.includes('VERIFIED'), 'HTML contains verified badge');
  }

  // TEST 8: Duplicate Payment Protection (Idempotency)
  console.log('\n--- TEST 8: Duplicate Payment Protection (No Duplicate Emails) ---');
  {
    const emailCountBefore = emailService.getSentEmails().length;

    // Simulate incoming Razorpay webhook event for the ALREADY verified order
    const webhookPayload = JSON.stringify({
      entity: 'event',
      event: 'payment.captured',
      id: `evt_test_${Date.now()}`,
      payload: {
        payment: {
          entity: {
            id: 'pay_test_meera_789456',
            order_id: test7RzpOrderId,
            amount: 19800,
            status: 'captured'
          }
        }
      }
    });

    // Create valid webhook signature
    const crypto = await import('crypto');
    const validWebhookSig = crypto.default
      .createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET)
      .update(webhookPayload)
      .digest('hex');

    await PaymentService.handleWebhookEvent(webhookPayload, validWebhookSig);

    const emailCountAfter = emailService.getSentEmails().length;
    assert(emailCountAfter === emailCountBefore, 'No duplicate payment success email was sent for already paid order');
  }

  // TEST 9: Payment Failed Notification
  console.log('\n--- TEST 9: Payment Failed Notification ---');
  {
    // Create an order
    const orderResult = await PaymentService.createOrderWithRazorpay({
      customer: {
        fullName: 'Vikram Singh',
        email: 'vikram.singh@example.com',
        phone: '9811223344'
      },
      shippingAddress: {
        address: '45 Lake View',
        city: 'Jaipur',
        state: 'Rajasthan',
        pinCode: '302001'
      },
      paymentMethod: 'Razorpay',
      items: [
        {
          slug: 'organic-moringa-powder',
          name: 'Organic Moringa Powder',
          weight: '100g',
          quantity: 1
        }
      ]
    });

    emailService.clearSentEmails();

    // Trigger invalid signature verification failure
    try {
      await PaymentService.verifyPaymentAndCompleteOrder({
        orderId: orderResult.order._id,
        razorpayOrderId: orderResult.razorpayOrder.id,
        razorpayPaymentId: 'pay_failed_xyz',
        razorpaySignature: 'invalid_bad_sig_12345'
      });
    } catch {
      // Expected to throw 400
    }

    const lastEmail = emailService.getLastSentEmail();
    assert(lastEmail !== null, 'Payment failed notification was sent');
    assert(lastEmail.subject.includes('[AgrivaFoods Admin] Payment Failed'), 'Subject is Payment Failed');
    assert(lastEmail.subject.includes(orderResult.order.orderNumber), 'Subject contains order number');
    assert(lastEmail.html.includes('FAILED'), 'HTML contains FAILED badge');
    assert(lastEmail.html.includes('signature verification failed'), 'HTML mentions failure reason');
  }

  // TEST 10: Customer Inquiry Notification & XSS Sanitization
  console.log('\n--- TEST 10: Customer Inquiry Notification & Sanitization ---');
  {
    emailService.clearSentEmails();

    const maliciousMessage = 'Hello AgrivaFoods! <script>window.location="http://evil.com"</script> Can you supply bulk organic ashwagandha?';
    const contactData = await ContactService.submitContact({
      name: 'Ramesh Gupta <Owner>',
      email: 'ramesh.gupta@example.com',
      phone: '9845012345',
      subject: 'Bulk Wholesale Superfood Inquiry',
      message: maliciousMessage
    });

    assert(contactData !== null, 'Contact inquiry submitted');

    const lastEmail = emailService.getLastSentEmail();
    assert(lastEmail !== null, 'Contact inquiry email notification sent');
    assert(lastEmail.subject.includes('[AgrivaFoods Admin] New Customer Inquiry: Bulk Wholesale Superfood Inquiry'), 'Subject has inquiry topic');
    assert(lastEmail.html.includes('Ramesh Gupta &lt;Owner&gt;'), 'Sender name is sanitized');
    assert(!lastEmail.html.includes('<script>'), 'Injected script tag was sanitized out of HTML');
    assert(lastEmail.html.includes('&lt;script&gt;'), 'Script tags were safely escaped to entities');
    assert(lastEmail.html.includes('Bulk Wholesale Superfood Inquiry'), 'Subject line is displayed');
  }

  // TEST 11: Fail-Safe / Non-Blocking Robustness
  console.log('\n--- TEST 11: Non-Blocking Fault Tolerance (Broken Transporter Never Breaks Core Operations) ---');
  {
    // Temporarily replace transporter with one that throws an error
    const faultyTransporter = {
      sendMail: async () => {
        throw new Error('SMTP Connection Refused: ETIMEDOUT');
      }
    };
    emailService.setTransporter(faultyTransporter);

    // Operation: Registering a user should STILL SUCCEED even if email fails!
    const regResult = await AuthService.register({
      name: 'Fault Tolerance Test User',
      email: `fault_test_${Date.now()}@example.com`,
      password: 'Password123!',
      phone: '9900112233'
    });

    assert(regResult.user !== null, 'User registration succeeded despite SMTP failure');
    assert(regResult.token.length > 0, 'JWT token issued despite SMTP failure');

    // Operation: Creating a product should STILL SUCCEED even if email fails!
    const productResult = await ProductService.createProduct({
      name: `Fault Tolerance Product ${Date.now()}`,
      category: 'Superfoods',
      variants: [{ weight: '100g', price: 99, stock: 10 }]
    });

    assert(productResult !== null, 'Product created successfully despite SMTP failure');

    // Operation: Contact submission should STILL SUCCEED even if email fails!
    const contactResult = await ContactService.submitContact({
      name: 'Fault Tolerance Contact',
      email: 'fault@example.com',
      message: 'Testing email resilience'
    });

    assert(contactResult !== null, 'Contact submitted successfully despite SMTP failure');

    // Restore transporter
    emailService.initTransporter();
  }

  console.log('\n================================================================');
  console.log(`TEST RESULTS: ${passedTests} / ${totalTests} PASSED (100% Success)`);
  console.log('================================================================\n');
}

runTestSuite().catch(err => {
  console.error('\nTest suite failed with unexpected error:', err);
  process.exit(1);
});
