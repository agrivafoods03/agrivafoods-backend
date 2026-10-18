import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Explicitly load .env from backend root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const host = (process.env.SMTP_HOST || '').trim();
const port = parseInt(process.env.SMTP_PORT, 10) || 587;
const user = (process.env.SMTP_USER || '').trim();
const pass = (process.env.SMTP_PASS || '').trim();
const fromEmail = (process.env.SMTP_FROM_EMAIL || 'notifications@agrivafoods.com').trim();
const adminEmail = (process.env.ADMIN_NOTIFICATION_EMAIL || 'admin@agrivafoods.com').trim();
const secure = process.env.SMTP_SECURE !== undefined
  ? process.env.SMTP_SECURE === 'true'
  : port === 465;

// Parse CLI arguments: --send-to <email>
const args = process.argv.slice(2);
let sendTo = null;
const sendToIndex = args.indexOf('--send-to');
if (sendToIndex !== -1 && args[sendToIndex + 1]) {
  sendTo = args[sendToIndex + 1].trim();
}

console.log('================================================================');
console.log('      AGRIVAFOODS SMTP CONNECTION & DIAGNOSTIC UTILITY');
console.log('================================================================\n');

console.log('--- Environment Configuration Inspection ---');
console.log(` • SMTP_HOST        : ${host || '(not set)'}`);
console.log(` • SMTP_PORT        : ${port} ${port === 25 ? '⚠️ [PORT 25 BLOCKED ON RENDER]' : ''}`);
console.log(` • SMTP_SECURE      : ${secure} (${secure ? 'SSL/TLS direct' : 'STARTTLS'})`);
console.log(` • SMTP_USER        : ${user ? `${user.substring(0, 3)}***@${user.includes('@') ? user.split('@')[1] : 'domain'}` : '(not set)'}`);
console.log(` • SMTP_PASS        : ${pass ? `[Set: ${pass.length} chars, masked]` : '(not set)'}`);
console.log(` • SMTP_FROM_EMAIL  : ${fromEmail}`);
console.log(` • ADMIN_EMAIL      : ${adminEmail}`);

// Validate whether credentials are placeholders or blank
const isPlaceholder = !host ||
  !user ||
  !pass ||
  host.includes('example.com') ||
  user.includes('your-') ||
  pass.includes('your-') ||
  pass.includes('password');

if (isPlaceholder) {
  console.log('\n----------------------------------------------------------------');
  console.log(' [STATUS] SMTP is currently UNCONFIGURED or using Placeholders.');
  console.log('----------------------------------------------------------------');
  console.log('The backend is operating safely in MOCK/LOGGER mode:');
  console.log(' • All notification events (orders, payments, registrations) succeed.');
  console.log(' • Emails are recorded in memory/logs and never fail user requests.');
  console.log(' • To enable real email delivery, configure valid SMTP credentials in backend/.env');
  console.log('\nSupported Providers:');
  console.log(' 1. Gmail (Personal/Workspace):');
  console.log('    SMTP_HOST=smtp.gmail.com');
  console.log('    SMTP_PORT=465');
  console.log('    SMTP_SECURE=true');
  console.log('    SMTP_USER=your_address@gmail.com');
  console.log('    SMTP_PASS=<16-character-google-app-password>');
  console.log('    SMTP_FROM_EMAIL=your_address@gmail.com');
  console.log('\n 2. Brevo / Sendinblue (Recommended for E-Commerce):');
  console.log('    SMTP_HOST=smtp-relay.brevo.com');
  console.log('    SMTP_PORT=587');
  console.log('    SMTP_SECURE=false');
  console.log('    SMTP_USER=<your-brevo-login-email>');
  console.log('    SMTP_PASS=<your-brevo-smtp-key>');
  console.log('    SMTP_FROM_EMAIL=<your-verified-sender>');
  console.log('================================================================\n');
  process.exit(0);
}

// Proceed to test actual SMTP transporter
console.log('\n--- Testing Transporter Initialization & Verification ---');

const transporter = nodemailer.createTransport({
  host,
  port,
  secure,
  auth: {
    user,
    pass
  },
  tls: {
    rejectUnauthorized: process.env.NODE_ENV === 'production'
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000
});

async function runDiagnostics() {
  try {
    console.log(`Connecting to ${host}:${port} (secure: ${secure})...`);
    await transporter.verify();
    console.log(' ✓ SUCCESS: SMTP transporter connected and verified successfully!');

    if (sendTo) {
      console.log(`\n--- Sending Authorized Test Email to: ${sendTo} ---`);
      const info = await transporter.sendMail({
        from: `"AgrivaFoods Notifications" <${fromEmail}>`,
        to: sendTo,
        subject: '[AgrivaFoods] SMTP Verification & Diagnostic Test',
        text: `Hello!\n\nThis is a verified test email from your AgrivaFoods backend.\nSMTP Host: ${host}\nSMTP Port: ${port}\nTimestamp: ${new Date().toISOString()}\n\nAll notification systems are operational!`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 560px; padding: 24px; border: 1px solid #e5e7eb; border-radius: 8px;">
            <h2 style="color: #166534; margin-top: 0;">🌿 AgrivaFoods SMTP Test</h2>
            <p>This email confirms that your SMTP provider credentials and Nodemailer transporter are operational.</p>
            <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px;">
              <tr><td style="padding: 6px 0; color: #6b7280;">Host:</td><td><strong>${host}</strong></td></tr>
              <tr><td style="padding: 6px 0; color: #6b7280;">Port:</td><td><strong>${port}</strong></td></tr>
              <tr><td style="padding: 6px 0; color: #6b7280;">Security:</td><td><strong>${secure ? 'SSL/TLS' : 'STARTTLS'}</strong></td></tr>
              <tr><td style="padding: 6px 0; color: #6b7280;">Sender:</td><td><strong>${fromEmail}</strong></td></tr>
              <tr><td style="padding: 6px 0; color: #6b7280;">Sent At:</td><td><strong>${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</strong></td></tr>
            </table>
            <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; padding: 12px; border-radius: 6px; color: #166534; font-size: 13px;">
              ✓ Ready for production deployment on Render.
            </div>
          </div>
        `
      });
      console.log(` ✓ Email sent successfully! MessageId: ${info.messageId}`);
    } else {
      console.log('\n [INFO] SMTP credentials are valid.');
      console.log(' To dispatch a real test email to an authorized inbox, run:');
      console.log(' node src/utils/testSmtpConnection.js --send-to your-email@example.com');
    }
  } catch (err) {
    console.error('\n ✗ ERROR: SMTP Connection or Authentication Failed');
    console.error(` Code    : ${err.code || 'UNKNOWN'}`);
    console.error(` Message : ${err.message}`);
    if (err.code === 'EAUTH') {
      console.error('\n [TROUBLESHOOTING EAUTH]');
      console.error(' • For Gmail: You MUST use a 16-character Google "App Password", not your normal password.');
      console.error(' • For Brevo/SendGrid: Ensure the API key / SMTP key has sending permissions.');
    } else if (err.code === 'ETIMEDOUT' || err.code === 'ECONNREFUSED') {
      console.error('\n [TROUBLESHOOTING TIMEOUT / REFUSED]');
      console.error(' • Ensure you are using port 587 or 465 (Port 25 is blocked).');
      console.error(' • Check your firewall or network connectivity.');
    }
    process.exit(1);
  }
}

runDiagnostics();
