import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import http from 'http';

// Helper to make HTTP requests against the Express app
function makeRequest(server, { method, path, headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const address = server.address();
    const options = {
      hostname: '127.0.0.1',
      port: address.port,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

test('AgrivaFoods Backend API Suite', async (t) => {
  let server;
  let authToken = '';
  let adminToken = '';
  let createdOrderNumber = '';

  t.before(async () => {
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
  });

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  await t.test('1. Health Check Endpoint', async () => {
    const res = await makeRequest(server, { method: 'GET', path: '/api/health' });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.status, 'online');
  });

  await t.test('2. Product Catalog Endpoints', async () => {
    // List products
    const listRes = await makeRequest(server, { method: 'GET', path: '/api/products' });
    assert.equal(listRes.status, 200);
    assert.equal(listRes.body.success, true);
    assert.ok(Array.isArray(listRes.body.data));
    assert.ok(listRes.body.data.length >= 3);

    // Get specific product by slug
    const singleRes = await makeRequest(server, { method: 'GET', path: '/api/products/slug/organic-moringa-powder' });
    assert.equal(singleRes.status, 200);
    assert.equal(singleRes.body.success, true);
    assert.equal(singleRes.body.data.slug, 'organic-moringa-powder');
    assert.ok(singleRes.body.data.variants.length > 0);

    // Categories
    const catRes = await makeRequest(server, { method: 'GET', path: '/api/products/categories' });
    assert.equal(catRes.status, 200);
    assert.ok(Array.isArray(catRes.body.data));
  });

  await t.test('3. Coupon Validation', async () => {
    // Valid coupon
    const validRes = await makeRequest(server, {
      method: 'POST',
      path: '/api/coupons/validate',
      body: { code: 'WELCOME10', subtotal: 600 }
    });
    assert.equal(validRes.status, 200);
    assert.equal(validRes.body.success, true);
    assert.equal(validRes.body.data.discountAmount, 60);

    // Invalid coupon
    const invalidRes = await makeRequest(server, {
      method: 'POST',
      path: '/api/coupons/validate',
      body: { code: 'FAKE_CODE', subtotal: 600 }
    });
    assert.equal(invalidRes.status, 404);
    assert.equal(invalidRes.body.success, false);
  });

  await t.test('4. Authentication Flow (Register & Login)', async () => {
    const testEmail = `tester_${Date.now()}@example.com`;
    // Register
    const regRes = await makeRequest(server, {
      method: 'POST',
      path: '/api/auth/register',
      body: {
        name: 'Unit Tester',
        email: testEmail,
        password: 'Password@123',
        phone: '+91 99999 88888'
      }
    });
    assert.equal(regRes.status, 201);
    assert.equal(regRes.body.success, true);
    assert.ok(regRes.body.data.token);
    authToken = regRes.body.data.token;

    // Login with registered user
    const loginRes = await makeRequest(server, {
      method: 'POST',
      path: '/api/auth/login',
      body: {
        email: testEmail,
        password: 'Password@123'
      }
    });
    assert.equal(loginRes.status, 200);
    assert.equal(loginRes.body.success, true);
    assert.ok(loginRes.body.data.token);

    // Get current profile
    const meRes = await makeRequest(server, {
      method: 'GET',
      path: '/api/auth/me',
      headers: { Authorization: `Bearer ${authToken}` }
    });
    assert.equal(meRes.status, 200);
    assert.equal(meRes.body.data.email, testEmail);

    // Login as Admin
    const adminLoginRes = await makeRequest(server, {
      method: 'POST',
      path: '/api/auth/login',
      body: {
        email: 'admin@agrivafoods.com',
        password: 'Admin@123'
      }
    });
    assert.equal(adminLoginRes.status, 200);
    assert.ok(adminLoginRes.body.data.token);
    adminToken = adminLoginRes.body.data.token;
  });

  await t.test('5. Order Creation & Order Tracking', async () => {
    const orderPayload = {
      customer: {
        name: 'Rohan Patil',
        email: 'rohan.p@example.com',
        phone: '+91 98222 33445'
      },
      shippingAddress: {
        street: '102 Green Heights, Kothrud',
        city: 'Pune',
        state: 'Maharashtra',
        pincode: '411038'
      },
      items: [
        {
          productSlug: 'organic-moringa-powder',
          productName: 'AgrivaFoods Moringa Powder',
          weight: '250g',
          price: 299,
          quantity: 2
        }
      ],
      paymentMethod: 'COD'
    };

    const res = await makeRequest(server, {
      method: 'POST',
      path: '/api/orders',
      headers: { Authorization: `Bearer ${authToken}` },
      body: orderPayload
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.orderNumber);
    assert.equal(res.body.data.subtotal, 598);
    assert.equal(res.body.data.shippingFee, 0); // Free shipping for >= 499
    assert.equal(res.body.data.paymentMethod, 'COD');
    assert.equal(res.body.data.paymentStatus, 'Pending');
    assert.equal(res.body.data.orderStatus, 'Placed');

    createdOrderNumber = res.body.data.orderNumber;

    // Track order by order number
    const trackRes = await makeRequest(server, {
      method: 'GET',
      path: `/api/orders/track/${createdOrderNumber}`
    });
    assert.equal(trackRes.status, 200);
    assert.equal(trackRes.body.data.orderNumber, createdOrderNumber);
    assert.equal(trackRes.body.data.paymentMethod, 'COD');
    assert.equal(trackRes.body.data.paymentStatus, 'Pending');

    // Test: Non-COD payment method rejection
    const nonCodRes = await makeRequest(server, {
      method: 'POST',
      path: '/api/orders',
      body: { ...orderPayload, paymentMethod: 'Razorpay' }
    });
    assert.equal(nonCodRes.status, 400);

    // Test: Obsolete Razorpay endpoints are safely disabled
    const rzpOrderRes = await makeRequest(server, {
      method: 'POST',
      path: '/api/payment/create-order',
      body: orderPayload
    });
    assert.equal(rzpOrderRes.status, 400);

    const rzpConfigRes = await makeRequest(server, {
      method: 'GET',
      path: '/api/payment/config'
    });
    assert.equal(rzpConfigRes.status, 200);
    assert.equal(rzpConfigRes.body.data.onlinePaymentEnabled, false);
    assert.deepEqual(rzpConfigRes.body.data.paymentMethods, ['COD']);
  });

  await t.test('6. Customer Review Submission & Upvote', async () => {
    const revRes = await makeRequest(server, {
      method: 'POST',
      path: '/api/reviews',
      body: {
        name: 'Anjali Verma',
        rating: 5,
        title: 'Superb Moringa Powder',
        comment: 'Fresh, vibrant green, and blends completely into my morning juice.',
        productName: 'AgrivaFoods Moringa Powder'
      }
    });
    assert.equal(revRes.status, 201);
    assert.equal(revRes.body.success, true);
    const reviewId = revRes.body.data._id;

    // Upvote review
    const upvoteRes = await makeRequest(server, {
      method: 'POST',
      path: `/api/reviews/${reviewId}/upvote`
    });
    assert.equal(upvoteRes.status, 200);
    assert.equal(upvoteRes.body.data.helpfulCount, 1);
  });

  await t.test('7. Contact Inquiry & Newsletter', async () => {
    // Contact inquiry
    const contactRes = await makeRequest(server, {
      method: 'POST',
      path: '/api/contact',
      body: {
        name: 'Sunil Rao',
        email: 'sunil.rao@example.com',
        phone: '+91 97654 32100',
        subject: 'Retail Distribution',
        message: 'Interested in stocking AgrivaFoods products in our organic stores.'
      }
    });
    assert.equal(contactRes.status, 201);
    assert.equal(contactRes.body.success, true);

    // Newsletter subscribe
    const newsRes = await makeRequest(server, {
      method: 'POST',
      path: '/api/newsletter/subscribe',
      body: { email: 'healthy_living@example.com' }
    });
    assert.equal(newsRes.status, 200);
    assert.equal(newsRes.body.success, true);
  });

  await t.test('8. Admin Dashboard & Protected Operations', async () => {
    // Admin access dashboard
    const dashRes = await makeRequest(server, {
      method: 'GET',
      path: '/api/admin/dashboard',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(dashRes.status, 200);
    assert.equal(dashRes.body.success, true);
    assert.ok(dashRes.body.data.overview.totalProducts >= 3);

    // Customer should be rejected with 403 on admin routes
    const forbidRes = await makeRequest(server, {
      method: 'GET',
      path: '/api/admin/dashboard',
      headers: { Authorization: `Bearer ${authToken}` }
    });
    assert.equal(forbidRes.status, 403);
  });

  await t.test('9. Admin Products & Inventory Management', async () => {
    // 1. Create new product
    const createRes = await makeRequest(server, {
      method: 'POST',
      path: '/api/admin/products',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        name: 'Organic Ashwagandha Powder',
        category: 'Superfood Powders',
        description: '100% Pure Root Powder for stress relief and vitality',
        variants: [
          { sku: 'AGR-ASH-100', weight: '100g', price: 199, originalPrice: 249, stock: 45 },
          { sku: 'AGR-ASH-250', weight: '250g', price: 399, originalPrice: 499, stock: 25 }
        ]
      }
    });
    assert.equal(createRes.status, 201);
    assert.equal(createRes.body.data.name, 'Organic Ashwagandha Powder');
    const createdId = createRes.body.data._id;

    // 2. Toggle publish
    const toggleRes = await makeRequest(server, {
      method: 'PATCH',
      path: `/api/admin/products/${createdId}/toggle-publish`,
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(toggleRes.status, 200);

    // 3. Update variant stock
    const invRes = await makeRequest(server, {
      method: 'PATCH',
      path: `/api/admin/inventory/${createdId}/variant/AGR-ASH-100`,
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { stock: 80, price: 219 }
    });
    assert.equal(invRes.status, 200);

    // 4. Query inventory list
    const listInv = await makeRequest(server, {
      method: 'GET',
      path: '/api/admin/inventory',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(listInv.status, 200);
    assert.ok(Array.isArray(listInv.body.data));
    assert.ok(listInv.body.data.some(i => i.sku === 'AGR-ASH-100'));
  });

  await t.test('10. Admin Categories & Homepage Content', async () => {
    // Categories CRUD
    const catRes = await makeRequest(server, {
      method: 'POST',
      path: '/api/admin/categories',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { name: 'Root Powders', description: 'Ayurvedic root adaptogens' }
    });
    assert.equal(catRes.status, 201);
    assert.equal(catRes.body.data.slug, 'root-powders');

    // Homepage Config
    const hpRes = await makeRequest(server, {
      method: 'PUT',
      path: '/api/admin/homepage',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        heroTitle: 'PURE BOTANICAL NOURISHMENT',
        featuredProductSlug: 'organic-moringa-powder'
      }
    });
    assert.equal(hpRes.status, 200);
    assert.equal(hpRes.body.data.heroTitle, 'PURE BOTANICAL NOURISHMENT');

    // Public homepage fetch
    const publicHp = await makeRequest(server, {
      method: 'GET',
      path: '/api/homepage'
    });
    assert.equal(publicHp.status, 200);
    assert.equal(publicHp.body.data.heroTitle, 'PURE BOTANICAL NOURISHMENT');
  });
});
