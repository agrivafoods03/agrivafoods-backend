import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import http from 'http';
import { emailService } from '../src/services/emailService.js';
import { User } from '../src/models/User.js';
import { memoryStore } from '../src/utils/memoryStore.js';
import { checkDbConnection } from '../src/config/db.js';

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

test('Admin Auth & Forgot Password / Reset OTP Suite', async (t) => {
  let server;
  let capturedOtp = null;
  let capturedTo = null;
  const originalSendOtp = emailService.sendAdminPasswordResetOtpEmail;
  const originalSendAlert = emailService.sendAdminPasswordChangedAlert;

  t.before(async () => {
    process.env.NODE_ENV = 'test';
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));

    // Intercept email sending to capture OTP without relying on external SMTP delivery
    emailService.sendAdminPasswordResetOtpEmail = async ({ to, otp, expiresInMinutes }) => {
      capturedTo = to;
      capturedOtp = otp;
      return { success: true, messageId: 'test-mock-id' };
    };

    emailService.sendAdminPasswordChangedAlert = async ({ to }) => {
      return { success: true, messageId: 'test-alert-mock-id' };
    };
  });

  t.after(async () => {
    // Restore original email service methods
    emailService.sendAdminPasswordResetOtpEmail = originalSendOtp;
    emailService.sendAdminPasswordChangedAlert = originalSendAlert;
    await new Promise((resolve) => server.close(resolve));
  });

  // Helper to clear cooldown between tests if needed
  async function clearAdminCooldown() {
    if (checkDbConnection()) {
      await User.updateMany({ role: 'admin' }, { $set: { resetPasswordLastRequested: null } });
    } else {
      memoryStore.users.filter(u => u.role === 'admin').forEach(u => {
        u.resetPasswordLastRequested = null;
      });
    }
  }

  await t.test('1. Reject invalid email format', async () => {
    const res = await makeRequest(server, {
      method: 'POST',
      path: '/api/admin/auth/forgot-password',
      body: { email: 'not-an-email' }
    });
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
  });

  await t.test('2. Non-existent email returns generic message without sending OTP', async () => {
    capturedOtp = null;
    const res = await makeRequest(server, {
      method: 'POST',
      path: '/api/admin/auth/forgot-password',
      body: { email: 'nonexistent-admin@example.com' }
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.message.includes('If an eligible administrator account exists'));
    assert.equal(capturedOtp, null, 'OTP must not be generated or sent for nonexistent account');
  });

  await t.test('3. Valid admin email triggers OTP generation and email dispatch', async () => {
    await clearAdminCooldown();
    capturedOtp = null;
    capturedTo = null;

    const res = await makeRequest(server, {
      method: 'POST',
      path: '/api/admin/auth/forgot-password',
      body: { email: 'admin@agrivafoods.com' }
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.message.includes('If an eligible administrator account exists'));
    assert.ok(capturedOtp, 'OTP must be captured');
    assert.equal(capturedOtp.length, 6, 'OTP must be 6 digits');
    assert.ok(/^\d{6}$/.test(capturedOtp), 'OTP must be numeric');
    assert.ok(capturedTo, 'Recipient email must be provided');
  });

  await t.test('4. Cooldown prevents immediate spamming of OTP requests', async () => {
    const res = await makeRequest(server, {
      method: 'POST',
      path: '/api/admin/auth/forgot-password',
      body: { email: 'admin@agrivafoods.com' }
    });
    assert.equal(res.status, 429);
    assert.equal(res.body.success, false);
    assert.ok(res.body.message.includes('Please wait'));
  });

  await t.test('5. Verify OTP rejects bad OTP format', async () => {
    const res = await makeRequest(server, {
      method: 'POST',
      path: '/api/admin/auth/verify-otp',
      body: { email: 'admin@agrivafoods.com', otp: '12' }
    });
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.ok(res.body.message.includes('6 digits'));
  });

  await t.test('6. Verify OTP rejects wrong code and tracks remaining attempts', async () => {
    const wrongOtp = capturedOtp === '111111' ? '222222' : '111111';
    const res = await makeRequest(server, {
      method: 'POST',
      path: '/api/admin/auth/verify-otp',
      body: { email: 'admin@agrivafoods.com', otp: wrongOtp }
    });
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.ok(res.body.message.includes('attempt(s) remaining'));
  });

  await t.test('7. 5 failed attempts invalidates the OTP', async () => {
    const wrongOtp = capturedOtp === '111111' ? '222222' : '111111';
    // Make 4 more invalid attempts (reaching 5 total)
    for (let i = 0; i < 3; i++) {
      await makeRequest(server, {
        method: 'POST',
        path: '/api/admin/auth/verify-otp',
        body: { email: 'admin@agrivafoods.com', otp: wrongOtp }
      });
    }
    // 5th attempt: should invalidate
    const finalInvalidRes = await makeRequest(server, {
      method: 'POST',
      path: '/api/admin/auth/verify-otp',
      body: { email: 'admin@agrivafoods.com', otp: wrongOtp }
    });
    assert.equal(finalInvalidRes.status, 429);
    assert.ok(finalInvalidRes.body.message.includes('Too many invalid attempts'));

    // Even correct OTP is now rejected because it was invalidated
    const tryCorrectRes = await makeRequest(server, {
      method: 'POST',
      path: '/api/admin/auth/verify-otp',
      body: { email: 'admin@agrivafoods.com', otp: capturedOtp }
    });
    assert.equal(tryCorrectRes.status, 400);
  });

  let freshOtp = null;
  let resetToken = null;

  await t.test('8. Request new OTP and verify with valid code', async () => {
    await clearAdminCooldown();
    capturedOtp = null;

    const reqRes = await makeRequest(server, {
      method: 'POST',
      path: '/api/admin/auth/forgot-password',
      body: { email: 'admin@agrivafoods.com' }
    });
    assert.equal(reqRes.status, 200);
    freshOtp = capturedOtp;
    assert.ok(freshOtp);

    const verifyRes = await makeRequest(server, {
      method: 'POST',
      path: '/api/admin/auth/verify-otp',
      body: { email: 'admin@agrivafoods.com', otp: freshOtp }
    });
    assert.equal(verifyRes.status, 200);
    assert.equal(verifyRes.body.success, true);
    assert.ok(verifyRes.body.data.resetToken);
    resetToken = verifyRes.body.data.resetToken;
  });

  await t.test('9. Prevent OTP reuse after verification', async () => {
    const reuseRes = await makeRequest(server, {
      method: 'POST',
      path: '/api/admin/auth/verify-otp',
      body: { email: 'admin@agrivafoods.com', otp: freshOtp }
    });
    assert.equal(reuseRes.status, 400);
    assert.ok(reuseRes.body.message.includes('Invalid or expired'));
  });

  await t.test('10. Reset Password validates matching passwords and minimum length', async () => {
    // Mismatch
    const mismatchRes = await makeRequest(server, {
      method: 'POST',
      path: '/api/admin/auth/reset-password',
      body: {
        email: 'admin@agrivafoods.com',
        resetToken,
        newPassword: 'ValidPassword123',
        confirmPassword: 'DifferentPassword123'
      }
    });
    assert.equal(mismatchRes.status, 400);
    assert.ok(mismatchRes.body.message.includes('do not match'));

    // Too short (< 8 chars)
    const shortRes = await makeRequest(server, {
      method: 'POST',
      path: '/api/admin/auth/reset-password',
      body: {
        email: 'admin@agrivafoods.com',
        resetToken,
        newPassword: 'short',
        confirmPassword: 'short'
      }
    });
    assert.equal(shortRes.status, 400);
    assert.ok(shortRes.body.message.includes('8 characters'));
  });

  const newAdminPassword = 'BrandNewAdminPass@2026';

  await t.test('11. Successfully reset password with valid resetToken', async () => {
    const resetRes = await makeRequest(server, {
      method: 'POST',
      path: '/api/admin/auth/reset-password',
      body: {
        email: 'admin@agrivafoods.com',
        resetToken,
        newPassword: newAdminPassword,
        confirmPassword: newAdminPassword
      }
    });
    assert.equal(resetRes.status, 200);
    assert.equal(resetRes.body.success, true);
  });

  await t.test('12. Reset token cannot be reused', async () => {
    const reuseTokenRes = await makeRequest(server, {
      method: 'POST',
      path: '/api/admin/auth/reset-password',
      body: {
        email: 'admin@agrivafoods.com',
        resetToken,
        newPassword: newAdminPassword,
        confirmPassword: newAdminPassword
      }
    });
    assert.equal(reuseTokenRes.status, 400);
    assert.ok(reuseTokenRes.body.message.includes('expired or is invalid'));
  });

  await t.test('13. Old password fails; new password authenticates successfully', async () => {
    // Old password fails
    const oldLoginRes = await makeRequest(server, {
      method: 'POST',
      path: '/api/auth/login',
      body: {
        email: 'admin@agrivafoods.com',
        password: 'Admin@123'
      }
    });
    assert.equal(oldLoginRes.status, 401);

    // New password succeeds
    const newLoginRes = await makeRequest(server, {
      method: 'POST',
      path: '/api/auth/login',
      body: {
        email: 'admin@agrivafoods.com',
        password: newAdminPassword
      }
    });
    assert.equal(newLoginRes.status, 200);
    assert.equal(newLoginRes.body.success, true);
    assert.ok(newLoginRes.body.data.token);
    assert.equal(newLoginRes.body.data.user.role, 'admin');

    // Also verify login with agrivafoods03@gmail.com succeeds
    const gmailLoginRes = await makeRequest(server, {
      method: 'POST',
      path: '/api/auth/login',
      body: {
        email: 'agrivafoods03@gmail.com',
        password: newAdminPassword
      }
    });
    assert.equal(gmailLoginRes.status, 200);
    assert.equal(gmailLoginRes.body.data.user.role, 'admin');
  });

  await t.test('14. Restore original admin password for continuous testing', async () => {
    await clearAdminCooldown();
    capturedOtp = null;

    // Trigger reset flow to reset back to 'Admin@123'
    await makeRequest(server, {
      method: 'POST',
      path: '/api/admin/auth/forgot-password',
      body: { email: 'admin@agrivafoods.com' }
    });

    const verifyRes = await makeRequest(server, {
      method: 'POST',
      path: '/api/admin/auth/verify-otp',
      body: { email: 'admin@agrivafoods.com', otp: capturedOtp }
    });
    const restoreToken = verifyRes.body.data.resetToken;

    const restoreRes = await makeRequest(server, {
      method: 'POST',
      path: '/api/admin/auth/reset-password',
      body: {
        email: 'admin@agrivafoods.com',
        resetToken: restoreToken,
        newPassword: 'Admin@123',
        confirmPassword: 'Admin@123'
      }
    });
    assert.equal(restoreRes.status, 200);

    // Verify Admin@123 works again
    const restoredLoginRes = await makeRequest(server, {
      method: 'POST',
      path: '/api/auth/login',
      body: {
        email: 'admin@agrivafoods.com',
        password: 'Admin@123'
      }
    });
    assert.equal(restoredLoginRes.status, 200);
  });
});
