import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

/**
 * HTML Escape helper to prevent HTML and script injection in notification emails
 */
export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Format currency in Indian Rupees
 */
export function formatINR(amount) {
  const num = Number(amount) || 0;
  return `₹${num.toLocaleString('en-IN')}`;
}

/**
 * Format timestamp nicely
 */
export function formatDateTime(date) {
  const d = date ? new Date(date) : new Date();
  return d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }) + ' IST';
}

class EmailService {
  constructor() {
    this.transporter = null;
    this.sentEmails = [];
    this.initTransporter();
  }

  /**
   * Initialize Nodemailer Transporter or fallback to mock mode
   */
  initTransporter() {
    const hasSmtpConfig = env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS;

    if (hasSmtpConfig) {
      try {
        this.transporter = nodemailer.createTransport({
          host: env.SMTP_HOST,
          port: env.SMTP_PORT,
          secure: env.SMTP_SECURE,
          auth: {
            user: env.SMTP_USER,
            pass: env.SMTP_PASS
          },
          tls: {
            rejectUnauthorized: env.NODE_ENV === 'production'
          },
          connectionTimeout: 10000,
          greetingTimeout: 10000,
          socketTimeout: 15000
        });
        logger.info(`[EmailService] Configured SMTP transporter for host ${env.SMTP_HOST}:${env.SMTP_PORT} (secure: ${env.SMTP_SECURE})`);
      } catch (err) {
        logger.error(`[EmailService] Error initializing SMTP transporter: ${err.message}. Defaulting to mock mode.`);
        this.transporter = null;
      }
    } else {
      logger.info('[EmailService] SMTP not fully configured in environment. Operating in mock/logger mode.');
      this.transporter = null;
    }
  }

  /**
   * Set custom transporter (useful for testing or dynamic config)
   */
  setTransporter(customTransporter) {
    this.transporter = customTransporter;
  }

  /**
   * Get queue of sent emails (mock / test inspection)
   */
  getSentEmails() {
    return [...this.sentEmails];
  }

  /**
   * Get the most recently sent email
   */
  getLastSentEmail() {
    return this.sentEmails.length > 0 ? this.sentEmails[this.sentEmails.length - 1] : null;
  }

  /**
   * Clear recorded sent emails
   */
  clearSentEmails() {
    this.sentEmails = [];
  }

  /**
   * Verify SMTP connection status
   */
  async verifyConnection() {
    if (!this.transporter) {
      return {
        configured: false,
        status: 'mock_mode',
        message: 'SMTP is not configured. Emails are captured in mock memory store.'
      };
    }

    try {
      await this.transporter.verify();
      return {
        configured: true,
        status: 'connected',
        message: 'SMTP transporter verified successfully.'
      };
    } catch (err) {
      logger.error(`[EmailService] SMTP verification failed: ${err.message}`);
      return {
        configured: true,
        status: 'error',
        message: err.message
      };
    }
  }

  /**
   * Standard Brand HTML Template Wrapper
   */
  renderEmailLayout({ badgeText, badgeColor = '#15803d', title, subtitle, contentHtml, ctaText, ctaUrl }) {
    const adminEmail = escapeHtml(env.ADMIN_NOTIFICATION_EMAIL);
    const clientUrl = env.CLIENT_URL || 'http://localhost:5173';
    const resolvedCtaUrl = ctaUrl ? (ctaUrl.startsWith('http') ? ctaUrl : `${clientUrl}${ctaUrl}`) : null;

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1f2937; line-height: 1.5;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f3f4f6; padding: 24px 12px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); border: 1px solid #e5e7eb;">
          
          <!-- Header Banner -->
          <tr>
            <td style="background-color: #2b5329; background: linear-gradient(135deg, #1e3d1d 0%, #2b5329 100%); padding: 28px 32px; text-align: left;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">
                      🌿 AgrivaFoods
                    </h1>
                    <p style="margin: 4px 0 0 0; font-size: 13px; color: #dcfce7; opacity: 0.9;">
                      100% Pure & Organic Superfoods • Admin Alert
                    </p>
                  </td>
                  <td align="right">
                    <span style="display: inline-block; padding: 6px 14px; background-color: rgba(255, 255, 255, 0.18); color: #ffffff; border-radius: 9999px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                      ${escapeHtml(badgeText)}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content Body -->
          <tr>
            <td style="padding: 32px;">
              <h2 style="margin: 0 0 8px 0; font-size: 20px; font-weight: 700; color: #111827;">
                ${escapeHtml(title)}
              </h2>
              ${subtitle ? `<p style="margin: 0 0 24px 0; font-size: 14px; color: #6b7280;">${escapeHtml(subtitle)}</p>` : '<div style="margin-bottom: 20px;"></div>'}

              <!-- Injected Dynamic Content -->
              ${contentHtml}

              <!-- Action Button -->
              ${resolvedCtaUrl ? `
              <div style="margin-top: 32px; text-align: center;">
                <a href="${resolvedCtaUrl}" target="_blank" style="display: inline-block; background-color: ${badgeColor}; color: #ffffff; font-weight: 600; font-size: 14px; padding: 12px 28px; text-decoration: none; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                  ${escapeHtml(ctaText || 'View in Admin Panel')} &rarr;
                </a>
              </div>
              ` : ''}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 20px 32px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 12px; color: #6b7280;">
              <p style="margin: 0 0 4px 0;">
                Sent to configured administrator: <strong>${adminEmail}</strong>
              </p>
              <p style="margin: 0; color: #9ca3af;">
                AgrivaFoods Automated Notifications • ${escapeHtml(formatDateTime(new Date()))}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }

  /**
   * Asynchronous, non-blocking email delivery engine
   * Never throws error to caller, safely logs and tracks results.
   */
  async sendAdminEmail({ to, subject, html, text }) {
    const targetRecipient = to || env.ADMIN_NOTIFICATION_EMAIL || 'admin@agrivafoods.com';
    const from = env.SMTP_FROM_EMAIL || 'notifications@agrivafoods.com';

    const mailOptions = {
      from: `"AgrivaFoods Notifications" <${from}>`,
      to: targetRecipient,
      subject,
      text,
      html
    };

    // Store in internal memory history for testing / diagnostics
    const record = {
      id: `mail_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      to: targetRecipient,
      from,
      subject,
      text,
      html,
      sentAt: new Date().toISOString()
    };
    this.sentEmails.push(record);

    try {
      if (this.transporter) {
        const info = await this.transporter.sendMail(mailOptions);
        logger.info(`[EmailService] Admin email sent successfully: "${subject}" to ${targetRecipient} (MessageId: ${info.messageId})`);
        return { success: true, messageId: info.messageId, mode: 'smtp' };
      } else {
        logger.info(`[EmailService] [Mock Mode] Admin email recorded: "${subject}" to ${targetRecipient}`);
        return { success: true, messageId: record.id, mode: 'mock' };
      }
    } catch (err) {
      logger.error(`[EmailService] Failed to deliver admin email "${subject}": ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  // =========================================================================
  // ADMIN PASSWORD RESET OTP NOTIFICATION
  // =========================================================================
  async sendAdminPasswordResetOtpEmail({ to, otp, expiresInMinutes = 10 }) {
    const title = 'Administrator Password Reset Code';
    const subtitle = 'One-time verification code for AgrivaFoods Admin Portal';
    const badgeText = 'Security OTP';
    const badgeColor = '#b45309';

    const contentHtml = `
      <div style="background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; padding: 18px; margin-bottom: 24px;">
        <p style="margin: 0 0 10px 0; font-size: 14px; color: #92400e; font-weight: 600;">
          Administrator Password Reset Request
        </p>
        <p style="margin: 0; font-size: 13px; color: #78350f;">
          We received a request to reset your administrator password for the <strong>AgrivaFoods Admin Portal</strong>. Use the 6-digit verification code below to proceed. This code expires in <strong>${expiresInMinutes} minutes</strong>.
        </p>
      </div>

      <div style="text-align: center; margin: 32px 0; padding: 24px 16px; background-color: #f9fafb; border: 2px dashed #009447; border-radius: 12px;">
        <span style="font-size: 12px; text-transform: uppercase; letter-spacing: 1.5px; color: #6b7280; font-weight: 700; display: block; margin-bottom: 10px;">
          One-Time Verification Code (OTP)
        </span>
        <span style="font-family: 'SF Mono', Consolas, Monaco, monospace; font-size: 38px; font-weight: 900; color: #18382A; letter-spacing: 12px; display: inline-block;">
          ${escapeHtml(otp)}
        </span>
      </div>

      <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 12px 16px; border-radius: 4px; font-size: 13px; color: #7f1d1d; margin-top: 24px;">
        <strong>Security Notice:</strong> If you did not request this password reset, please ignore this email. Your current administrator password remains unchanged and protected. Never disclose this code to anyone.
      </div>
    `;

    const html = this.renderEmailLayout({
      badgeText,
      badgeColor,
      title,
      subtitle,
      contentHtml
    });

    const text = `AgrivaFoods Admin Password Reset Code: ${otp}\n\nThis 6-digit verification code expires in ${expiresInMinutes} minutes.\n\nIf you did not request this, please ignore this email.`;

    return this.sendAdminEmail({
      to,
      subject: `[AgrivaFoods Security] Admin Password Reset Code: ${otp.substring(0, 3)}***`,
      html,
      text
    });
  }

  // =========================================================================
  // ADMIN PASSWORD CHANGED CONFIRMATION
  // =========================================================================
  async sendAdminPasswordChangedAlert({ to }) {
    const title = 'Administrator Password Changed Successfully';
    const subtitle = 'Security confirmation alert for AgrivaFoods Admin Portal';
    const badgeText = 'Security Alert';
    const badgeColor = '#009447';

    const contentHtml = `
      <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 18px; margin-bottom: 24px;">
        <p style="margin: 0 0 10px 0; font-size: 14px; color: #166534; font-weight: 600;">
          Your administrator password has been updated.
        </p>
        <p style="margin: 0; font-size: 13px; color: #15803d;">
          You can now sign in to the AgrivaFoods Admin Dashboard with your new password. All prior reset verification codes have been invalidated.
        </p>
      </div>

      <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 12px 16px; border-radius: 4px; font-size: 13px; color: #7f1d1d;">
        <strong>Important:</strong> If you did not perform this password change, your account may be compromised. Please contact technical support immediately.
      </div>
    `;

    const html = this.renderEmailLayout({
      badgeText,
      badgeColor,
      title,
      subtitle,
      contentHtml,
      ctaText: 'Sign In to Admin Portal',
      ctaUrl: '/admin/login'
    });

    const text = `AgrivaFoods Admin Password Changed Successfully.\n\nIf you did not perform this change, contact support immediately.`;

    return this.sendAdminEmail({
      to,
      subject: `[AgrivaFoods Security] Admin Password Changed Successfully`,
      html,
      text
    });
  }

  // =========================================================================
  // 1. PRODUCT CREATED NOTIFICATION
  // =========================================================================
  async sendProductCreatedNotification(product) {
    try {
      const prodId = product._id || product.id || 'N/A';
      const prodName = product.name || 'Untitled Product';
      const category = product.category || 'Uncategorized';
      const status = product.status || (product.isActive ? 'published' : 'draft');
      const createdAt = product.createdAt || new Date();
      const variants = Array.isArray(product.variants) ? product.variants : [];
      const primarySku = product.sku || variants[0]?.sku || 'N/A';

      const variantsHtml = variants.length > 0
        ? variants.map(v => `
            <tr>
              <td style="padding: 8px 12px; border-bottom: 1px solid #f3f4f6; font-size: 13px; font-weight: 500;">${escapeHtml(v.weight || 'Standard')}</td>
              <td style="padding: 8px 12px; border-bottom: 1px solid #f3f4f6; font-size: 13px; color: #166534; font-weight: 600;">${formatINR(v.price)}</td>
              <td style="padding: 8px 12px; border-bottom: 1px solid #f3f4f6; font-size: 13px;">${escapeHtml(v.stock ?? 0)} units</td>
              <td style="padding: 8px 12px; border-bottom: 1px solid #f3f4f6; font-size: 13px; color: #6b7280; font-family: monospace;">${escapeHtml(v.sku || '-')}</td>
            </tr>
          `).join('')
        : '<tr><td colspan="4" style="padding: 8px 12px; color: #9ca3af; text-align: center;">No variants defined</td></tr>';

      const variantsText = variants.map(v => `  - ${v.weight || 'Default'}: ${formatINR(v.price)} (Stock: ${v.stock || 0}, SKU: ${v.sku || 'N/A'})`).join('\n');

      const contentHtml = `
        <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size: 14px;">
            <tr>
              <td style="padding: 6px 0; color: #6b7280; width: 140px;">Product Name:</td>
              <td style="padding: 6px 0; font-weight: 600; color: #111827;">${escapeHtml(prodName)}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #6b7280;">Product ID:</td>
              <td style="padding: 6px 0; font-family: monospace; color: #374151;">${escapeHtml(prodId)}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #6b7280;">Primary SKU:</td>
              <td style="padding: 6px 0; font-family: monospace; color: #374151;">${escapeHtml(primarySku)}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #6b7280;">Category:</td>
              <td style="padding: 6px 0; color: #111827;">${escapeHtml(category)}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #6b7280;">Publication Status:</td>
              <td style="padding: 6px 0;">
                <span style="display: inline-block; padding: 2px 8px; font-size: 12px; font-weight: 600; border-radius: 4px; background-color: ${status === 'published' ? '#dcfce7' : '#fef3c7'}; color: ${status === 'published' ? '#166534' : '#92400e'};">
                  ${escapeHtml(status.toUpperCase())}
                </span>
              </td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #6b7280;">Created At:</td>
              <td style="padding: 6px 0; color: #374151;">${escapeHtml(formatDateTime(createdAt))}</td>
            </tr>
          </table>
        </div>

        <h3 style="margin: 0 0 12px 0; font-size: 15px; font-weight: 600; color: #374151;">Configured Variants & Pricing</h3>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; margin-bottom: 12px;">
          <tr style="background-color: #f3f4f6; text-align: left; font-size: 12px; color: #6b7280; font-weight: 600; text-transform: uppercase;">
            <th style="padding: 8px 12px;">Variant / Weight</th>
            <th style="padding: 8px 12px;">Selling Price</th>
            <th style="padding: 8px 12px;">Stock</th>
            <th style="padding: 8px 12px;">SKU</th>
          </tr>
          ${variantsHtml}
        </table>
      `;

      const subject = `[AgrivaFoods Admin] New Product Created: ${prodName}`;
      const text = `
=== AGRIVAFOODS ADMIN: NEW PRODUCT CREATED ===

A new product has been added to the catalog:

- Product Name: ${prodName}
- Product ID: ${prodId}
- Primary SKU: ${primarySku}
- Category: ${category}
- Status: ${status}
- Created: ${formatDateTime(createdAt)}

Variants:
${variantsText || '  (No variants configured)'}

View or edit product in Admin Panel:
${env.CLIENT_URL}/admin/products/${prodId}/edit
      `.trim();

      const html = this.renderEmailLayout({
        badgeText: 'New Product',
        badgeColor: '#15803d',
        title: `Product Created: ${prodName}`,
        subtitle: `A new product has been successfully added to the AgrivaFoods catalog.`,
        contentHtml,
        ctaText: 'Edit Product in Admin Panel',
        ctaUrl: `/admin/products/${prodId}/edit`
      });

      return await this.sendAdminEmail({ subject, html, text });
    } catch (err) {
      logger.error(`[EmailService] Error preparing product created email: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  // =========================================================================
  // 2. PRODUCT UPDATED NOTIFICATION
  // =========================================================================
  async sendProductUpdatedNotification(product, changes = []) {
    try {
      if (!changes || changes.length === 0) {
        return { success: true, skipped: true, reason: 'No notable changes' };
      }

      const prodId = product._id || product.id || 'N/A';
      const prodName = product.name || 'Product';
      const updatedAt = new Date();

      const changesRowsHtml = changes.map(ch => `
        <tr>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #374151; font-size: 13px;">
            ${escapeHtml(ch.field)}
          </td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #991b1b; background-color: #fef2f2; font-size: 13px; font-family: monospace;">
            ${escapeHtml(ch.oldValue ?? '(none)')}
          </td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #166534; background-color: #f0fdf4; font-size: 13px; font-weight: 600; font-family: monospace;">
            ${escapeHtml(ch.newValue ?? '(none)')}
          </td>
        </tr>
      `).join('');

      const changesText = changes.map(ch => `  - ${ch.field}: "${ch.oldValue}" -> "${ch.newValue}"`).join('\n');

      const contentHtml = `
        <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px 16px; margin-bottom: 20px; font-size: 14px;">
          <strong>Product:</strong> ${escapeHtml(prodName)} &bull; <span style="font-family: monospace; color: #6b7280;">ID: ${escapeHtml(prodId)}</span><br>
          <span style="color: #6b7280; font-size: 13px;">Updated on: ${escapeHtml(formatDateTime(updatedAt))}</span>
        </div>

        <h3 style="margin: 0 0 12px 0; font-size: 15px; font-weight: 600; color: #374151;">Changes Summary (${changes.length})</h3>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; margin-bottom: 12px;">
          <tr style="background-color: #f3f4f6; text-align: left; font-size: 12px; color: #6b7280; font-weight: 600; text-transform: uppercase;">
            <th style="padding: 8px 12px;">Field</th>
            <th style="padding: 8px 12px;">Previous Value</th>
            <th style="padding: 8px 12px;">Updated Value</th>
          </tr>
          ${changesRowsHtml}
        </table>
      `;

      const subject = `[AgrivaFoods Admin] Product Updated: ${prodName}`;
      const text = `
=== AGRIVAFOODS ADMIN: PRODUCT UPDATED ===

Product details have been updated:

- Product: ${prodName} (ID: ${prodId})
- Updated At: ${formatDateTime(updatedAt)}

Changes:
${changesText}

View or edit product in Admin Panel:
${env.CLIENT_URL}/admin/products/${prodId}/edit
      `.trim();

      const html = this.renderEmailLayout({
        badgeText: 'Product Updated',
        badgeColor: '#0284c7',
        title: `Product Updated: ${prodName}`,
        subtitle: `Changes were recently applied to product "${prodName}".`,
        contentHtml,
        ctaText: 'View Product in Admin',
        ctaUrl: `/admin/products/${prodId}/edit`
      });

      return await this.sendAdminEmail({ subject, html, text });
    } catch (err) {
      logger.error(`[EmailService] Error preparing product updated email: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  // =========================================================================
  // 3. NEW USER REGISTRATION NOTIFICATION
  // =========================================================================
  async sendUserRegisteredNotification(user) {
    try {
      const userId = user._id || user.id || 'N/A';
      const userName = user.name || 'Anonymous Customer';
      const userEmail = user.email || 'N/A';
      const userPhone = user.phone || 'Not provided';
      const registeredAt = user.createdAt || new Date();

      const contentHtml = `
        <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 18px; margin-bottom: 20px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size: 14px;">
            <tr>
              <td style="padding: 6px 0; color: #6b7280; width: 140px;">Customer Name:</td>
              <td style="padding: 6px 0; font-weight: 600; color: #111827;">${escapeHtml(userName)}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #6b7280;">Email Address:</td>
              <td style="padding: 6px 0; font-weight: 500; color: #166534;">${escapeHtml(userEmail)}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #6b7280;">Phone Number:</td>
              <td style="padding: 6px 0; color: #374151;">${escapeHtml(userPhone)}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #6b7280;">Customer ID:</td>
              <td style="padding: 6px 0; font-family: monospace; color: #6b7280;">${escapeHtml(userId)}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #6b7280;">Registered On:</td>
              <td style="padding: 6px 0; color: #374151;">${escapeHtml(formatDateTime(registeredAt))}</td>
            </tr>
          </table>
        </div>
        <p style="font-size: 13px; color: #6b7280; margin: 0 0 16px 0;">
          The customer has successfully created an account and can now log in, view order history, and save shipping addresses.
        </p>
      `;

      const subject = `[AgrivaFoods Admin] New Customer Registration: ${userName} (${userEmail})`;
      const text = `
=== AGRIVAFOODS ADMIN: NEW CUSTOMER REGISTRATION ===

A new customer has registered on the website:

- Name: ${userName}
- Email: ${userEmail}
- Phone: ${userPhone}
- Customer ID: ${userId}
- Registered At: ${formatDateTime(registeredAt)}

View Admin Dashboard:
${env.CLIENT_URL}/admin/dashboard
      `.trim();

      const html = this.renderEmailLayout({
        badgeText: 'New User',
        badgeColor: '#16a34a',
        title: `New Customer Registration`,
        subtitle: `${userName} has registered an account on AgrivaFoods.`,
        contentHtml,
        ctaText: 'Open Admin Dashboard',
        ctaUrl: `/admin/dashboard`
      });

      return await this.sendAdminEmail({ subject, html, text });
    } catch (err) {
      logger.error(`[EmailService] Error preparing user registered email: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  // =========================================================================
  // 4. NEW ORDER PLACED NOTIFICATION
  // =========================================================================
  async sendOrderCreatedNotification(order) {
    try {
      const orderNumber = order.orderNumber || 'N/A';
      const customer = order.customer || {};
      const customerName = customer.fullName || customer.name || 'Customer';
      const customerEmail = customer.email || 'N/A';
      const customerPhone = customer.phone || 'N/A';

      const shipping = order.shippingAddress || {};
      const shippingFormatted = [
        shipping.address || shipping.street,
        shipping.apartment,
        shipping.city,
        shipping.state,
        shipping.pinCode || shipping.pincode,
        shipping.country || 'India'
      ].filter(Boolean).join(', ');

      const items = Array.isArray(order.items) ? order.items : [];
      const subtotal = order.subtotal || 0;
      const shippingFee = order.shippingFee ?? order.shipping ?? 0;
      const discount = order.discount || 0;
      const total = order.total || 0;
      const rawPaymentMethod = order.paymentMethod || 'COD';
      const isCod = rawPaymentMethod.toUpperCase() === 'COD' || rawPaymentMethod.toLowerCase() === 'cash on delivery';
      const paymentMethod = isCod ? 'Cash on Delivery (COD)' : rawPaymentMethod;
      const paymentStatus = order.paymentStatus || 'Pending';
      const paymentStatusText = isCod
        ? (paymentStatus.toLowerCase() === 'completed' || paymentStatus.toLowerCase() === 'paid' ? 'Completed (Collected)' : 'Pending (Pay on Delivery)')
        : paymentStatus;
      const createdAt = order.placedAt || order.createdAt || new Date();

      const itemsHtml = items.map(item => `
        <tr>
          <td style="padding: 10px 12px; border-bottom: 1px solid #f3f4f6;">
            <div style="font-weight: 600; font-size: 13px; color: #111827;">${escapeHtml(item.name || item.productName)}</div>
            <div style="font-size: 12px; color: #6b7280;">Variant: ${escapeHtml(item.weight || 'Standard')}</div>
          </td>
          <td align="center" style="padding: 10px 12px; border-bottom: 1px solid #f3f4f6; font-size: 13px; color: #374151;">
            ${item.quantity || 1}
          </td>
          <td align="right" style="padding: 10px 12px; border-bottom: 1px solid #f3f4f6; font-size: 13px; color: #374151;">
            ${formatINR(item.price)}
          </td>
          <td align="right" style="padding: 10px 12px; border-bottom: 1px solid #f3f4f6; font-size: 13px; font-weight: 600; color: #111827;">
            ${formatINR((item.price || 0) * (item.quantity || 1))}
          </td>
        </tr>
      `).join('');

      const itemsText = items.map(item =>
        `  - ${item.name || item.productName} (${item.weight || 'Std'}) x ${item.quantity} = ${formatINR((item.price || 0) * (item.quantity || 1))}`
      ).join('\n');

      const contentHtml = `
        <!-- Order Meta Highlights -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 24px; background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px;">
          <tr>
            <td width="50%" valign="top" style="padding-right: 12px;">
              <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; font-weight: 600;">Order Reference</div>
              <div style="font-size: 18px; font-weight: 700; color: #166534; font-family: monospace; margin: 4px 0 12px 0;">#${escapeHtml(orderNumber)}</div>
              
              <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; font-weight: 600;">Payment Info</div>
              <div style="font-size: 14px; color: #111827; margin: 4px 0;">Method: <strong>${escapeHtml(paymentMethod)}</strong></div>
              <div style="font-size: 14px; color: #111827;">Status: <span style="font-weight: 600; color: ${paymentStatus === 'Completed' || paymentStatus === 'paid' ? '#166534' : '#d97706'};">${escapeHtml(paymentStatusText)}</span></div>
            </td>
            <td width="50%" valign="top" style="padding-left: 12px; border-left: 1px solid #e5e7eb;">
              <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; font-weight: 600;">Customer Details</div>
              <div style="font-size: 14px; font-weight: 600; color: #111827; margin: 4px 0 2px 0;">${escapeHtml(customerName)}</div>
              <div style="font-size: 13px; color: #4b5563;">✉ ${escapeHtml(customerEmail)}</div>
              <div style="font-size: 13px; color: #4b5563;">☎ ${escapeHtml(customerPhone)}</div>
              <div style="font-size: 12px; color: #9ca3af; margin-top: 6px;">Placed: ${escapeHtml(formatDateTime(createdAt))}</div>
            </td>
          </tr>
        </table>

        <!-- Shipping Address -->
        <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 16px; margin-bottom: 24px; font-size: 13px;">
          <strong style="color: #374151;">Delivery Address:</strong><br>
          <span style="color: #4b5563;">${escapeHtml(shippingFormatted)}</span>
        </div>

        <!-- Items Table -->
        <h3 style="margin: 0 0 12px 0; font-size: 15px; font-weight: 600; color: #374151;">Items in this Order</h3>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; margin-bottom: 16px;">
          <tr style="background-color: #f3f4f6; text-align: left; font-size: 12px; color: #6b7280; font-weight: 600; text-transform: uppercase;">
            <th style="padding: 8px 12px;">Product</th>
            <th align="center" style="padding: 8px 12px;">Qty</th>
            <th align="right" style="padding: 8px 12px;">Price</th>
            <th align="right" style="padding: 8px 12px;">Total</th>
          </tr>
          ${itemsHtml}
        </table>

        <!-- Financial Summary -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size: 14px; margin-bottom: 16px;">
          <tr>
            <td align="right" style="padding: 4px 12px; color: #6b7280;">Subtotal:</td>
            <td align="right" width="100" style="padding: 4px 0; font-weight: 500;">${formatINR(subtotal)}</td>
          </tr>
          <tr>
            <td align="right" style="padding: 4px 12px; color: #6b7280;">Shipping Fee:</td>
            <td align="right" style="padding: 4px 0; font-weight: 500;">${shippingFee === 0 ? '<span style="color: #166534;">Free</span>' : formatINR(shippingFee)}</td>
          </tr>
          ${discount > 0 ? `
          <tr>
            <td align="right" style="padding: 4px 12px; color: #16a34a;">Discount ${order.couponCode ? `(${escapeHtml(order.couponCode)})` : ''}:</td>
            <td align="right" style="padding: 4px 0; font-weight: 500; color: #16a34a;">-${formatINR(discount)}</td>
          </tr>
          ` : ''}
          <tr>
            <td align="right" style="padding: 8px 12px; font-weight: 700; font-size: 16px; color: #111827; border-top: 1px solid #e5e7eb;">${isCod ? 'Total Payable on Delivery:' : 'Grand Total:'}</td>
            <td align="right" style="padding: 8px 0; font-weight: 700; font-size: 16px; color: #166534; border-top: 1px solid #e5e7eb;">${formatINR(total)}</td>
          </tr>
        </table>
      `;

      const subject = isCod
        ? `[AgrivaFoods Admin] New COD Order Placed: #${orderNumber} (${formatINR(total)})`
        : `[AgrivaFoods Admin] New Order Placed: #${orderNumber} (${formatINR(total)})`;
      const text = `
=== AGRIVAFOODS ADMIN: NEW ORDER PLACED ===

Order Reference: #${orderNumber}
Total Amount Due: ${formatINR(total)}
Payment Method: ${paymentMethod} (${paymentStatusText})
Placed At: ${formatDateTime(createdAt)}

Customer Details:
- Name: ${customerName}
- Email: ${customerEmail}
- Phone: ${customerPhone}

Shipping Address:
${shippingFormatted}

Items:
${itemsText}

Financial Breakdown:
- Subtotal: ${formatINR(subtotal)}
- Shipping: ${shippingFee === 0 ? 'Free' : formatINR(shippingFee)}
${discount > 0 ? `- Discount: -${formatINR(discount)} (${order.couponCode || 'Promo'})\n` : ''}- Total: ${formatINR(total)}

Manage orders in Admin Panel:
${env.CLIENT_URL}/admin/orders
      `.trim();

      const html = this.renderEmailLayout({
        badgeText: 'New Order',
        badgeColor: '#15803d',
        title: `Order Received: #${orderNumber}`,
        subtitle: `A new customer order totaling ${formatINR(total)} has been submitted.`,
        contentHtml,
        ctaText: 'View Order in Admin Panel',
        ctaUrl: `/admin/orders`
      });

      return await this.sendAdminEmail({ subject, html, text });
    } catch (err) {
      logger.error(`[EmailService] Error preparing order created email: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  // =========================================================================
  // 5. PAYMENT SUCCESS NOTIFICATION
  // =========================================================================
  async sendPaymentSuccessNotification(order) {
    try {
      const orderNumber = order.orderNumber || 'N/A';
      const customer = order.customer || {};
      const customerName = customer.fullName || customer.name || 'Customer';
      const customerEmail = customer.email || 'N/A';
      const total = order.total || 0;
      const razorpayPaymentId = order.razorpayPaymentId || 'N/A';
      const razorpayOrderId = order.razorpayOrderId || 'N/A';
      const paidAt = order.paidAt || new Date();

      const contentHtml = `
        <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 18px; margin-bottom: 24px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size: 14px;">
            <tr>
              <td style="padding: 6px 0; color: #166534; font-weight: 600; width: 160px;">Payment Status:</td>
              <td style="padding: 6px 0;">
                <span style="background-color: #22c55e; color: #ffffff; padding: 2px 10px; border-radius: 9999px; font-size: 12px; font-weight: 700; text-transform: uppercase;">
                  VERIFIED &bull; PAID
                </span>
              </td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #374151; font-weight: 500;">Order Reference:</td>
              <td style="padding: 6px 0; font-weight: 700; font-family: monospace; color: #111827;">#${escapeHtml(orderNumber)}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #374151; font-weight: 500;">Amount Verified:</td>
              <td style="padding: 6px 0; font-weight: 700; color: #15803d; font-size: 16px;">${formatINR(total)} (INR)</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #374151; font-weight: 500;">Customer Name:</td>
              <td style="padding: 6px 0; color: #111827;">${escapeHtml(customerName)} (${escapeHtml(customerEmail)})</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #6b7280;">Razorpay Payment ID:</td>
              <td style="padding: 6px 0; font-family: monospace; color: #111827; font-weight: 600;">${escapeHtml(razorpayPaymentId)}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #6b7280;">Razorpay Order ID:</td>
              <td style="padding: 6px 0; font-family: monospace; color: #4b5563;">${escapeHtml(razorpayOrderId)}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #6b7280;">Payment Method:</td>
              <td style="padding: 6px 0; color: #374151;">Razorpay Payment Gateway (Online)</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #6b7280;">Paid Timestamp:</td>
              <td style="padding: 6px 0; color: #374151;">${escapeHtml(formatDateTime(paidAt))}</td>
            </tr>
          </table>
        </div>

        <p style="font-size: 13px; color: #4b5563; margin: 0 0 16px 0;">
          The inventory stock has been automatically deducted and the order status updated to <strong>Processing</strong>.
        </p>
      `;

      const subject = `[AgrivaFoods Admin] Payment Verified: #${orderNumber} (${formatINR(total)})`;
      const text = `
=== AGRIVAFOODS ADMIN: PAYMENT VERIFIED ===

Payment has been successfully verified for Order #${orderNumber}!

- Order Number: #${orderNumber}
- Customer: ${customerName} (${customerEmail})
- Amount Paid: ${formatINR(total)} INR
- Razorpay Payment ID: ${razorpayPaymentId}
- Razorpay Order ID: ${razorpayOrderId}
- Verified At: ${formatDateTime(paidAt)}
- Order Status: Processing / Paid

View Order in Admin Panel:
${env.CLIENT_URL}/admin/orders
      `.trim();

      const html = this.renderEmailLayout({
        badgeText: 'Payment Paid',
        badgeColor: '#15803d',
        title: `Payment Verified: #${orderNumber}`,
        subtitle: `Razorpay payment of ${formatINR(total)} was successfully captured and verified.`,
        contentHtml,
        ctaText: 'View Order in Admin',
        ctaUrl: `/admin/orders`
      });

      return await this.sendAdminEmail({ subject, html, text });
    } catch (err) {
      logger.error(`[EmailService] Error preparing payment success email: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  // =========================================================================
  // 6. PAYMENT FAILED NOTIFICATION
  // =========================================================================
  async sendPaymentFailedNotification(order, reason = 'Payment was declined or cancelled') {
    try {
      const orderNumber = order?.orderNumber || 'Unassigned';
      const customer = order?.customer || {};
      const customerName = customer.fullName || customer.name || 'Customer';
      const customerEmail = customer.email || 'N/A';
      const total = order?.total || 0;
      const razorpayOrderId = order?.razorpayOrderId || 'N/A';
      const razorpayPaymentId = order?.razorpayPaymentId || 'N/A';
      const failedAt = new Date();

      const contentHtml = `
        <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 18px; margin-bottom: 24px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size: 14px;">
            <tr>
              <td style="padding: 6px 0; color: #991b1b; font-weight: 600; width: 160px;">Payment Status:</td>
              <td style="padding: 6px 0;">
                <span style="background-color: #dc2626; color: #ffffff; padding: 2px 10px; border-radius: 9999px; font-size: 12px; font-weight: 700; text-transform: uppercase;">
                  FAILED
                </span>
              </td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #374151; font-weight: 500;">Order Reference:</td>
              <td style="padding: 6px 0; font-weight: 700; font-family: monospace; color: #111827;">#${escapeHtml(orderNumber)}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #374151; font-weight: 500;">Amount Attempted:</td>
              <td style="padding: 6px 0; font-weight: 700; color: #991b1b; font-size: 15px;">${formatINR(total)}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #374151; font-weight: 500;">Customer:</td>
              <td style="padding: 6px 0; color: #111827;">${escapeHtml(customerName)} (${escapeHtml(customerEmail)})</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #991b1b; font-weight: 600;">Failure Reason:</td>
              <td style="padding: 6px 0; color: #b91c1c; font-weight: 600;">${escapeHtml(reason)}</td>
            </tr>
            ${razorpayPaymentId !== 'N/A' ? `
            <tr>
              <td style="padding: 6px 0; color: #6b7280;">Payment ID:</td>
              <td style="padding: 6px 0; font-family: monospace; color: #374151;">${escapeHtml(razorpayPaymentId)}</td>
            </tr>
            ` : ''}
            <tr>
              <td style="padding: 6px 0; color: #6b7280;">Razorpay Order ID:</td>
              <td style="padding: 6px 0; font-family: monospace; color: #374151;">${escapeHtml(razorpayOrderId)}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #6b7280;">Failure Timestamp:</td>
              <td style="padding: 6px 0; color: #374151;">${escapeHtml(formatDateTime(failedAt))}</td>
            </tr>
          </table>
        </div>

        <p style="font-size: 13px; color: #6b7280; margin: 0 0 16px 0;">
          The customer has been notified with the order failure page and can retry payment or choose another payment method.
        </p>
      `;

      const subject = `[AgrivaFoods Admin] Payment Failed: #${orderNumber}`;
      const text = `
=== AGRIVAFOODS ADMIN: PAYMENT FAILED ===

A payment attempt has failed:

- Order Number: #${orderNumber}
- Customer: ${customerName} (${customerEmail})
- Amount Attempted: ${formatINR(total)}
- Reason: ${reason}
- Razorpay Payment ID: ${razorpayPaymentId}
- Razorpay Order ID: ${razorpayOrderId}
- Failed At: ${formatDateTime(failedAt)}

View Orders in Admin Panel:
${env.CLIENT_URL}/admin/orders
      `.trim();

      const html = this.renderEmailLayout({
        badgeText: 'Payment Failed',
        badgeColor: '#dc2626',
        title: `Payment Failed: #${orderNumber}`,
        subtitle: `An online payment attempt failed or could not be verified.`,
        contentHtml,
        ctaText: 'Review Order in Admin',
        ctaUrl: `/admin/orders`
      });

      return await this.sendAdminEmail({ subject, html, text });
    } catch (err) {
      logger.error(`[EmailService] Error preparing payment failed email: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  // =========================================================================
  // 7. CUSTOMER CONTACT / INQUIRY NOTIFICATION
  // =========================================================================
  async sendContactInquiryNotification(inquiry) {
    try {
      const name = inquiry.name || 'Anonymous';
      const email = inquiry.email || 'N/A';
      const phone = inquiry.phone || 'Not provided';
      const subjectLine = inquiry.subject || 'General Inquiry';
      const message = inquiry.message || '';
      const submittedAt = inquiry.createdAt || new Date();
      const inquiryId = inquiry._id || inquiry.id || 'N/A';

      const contentHtml = `
        <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 18px; margin-bottom: 20px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size: 14px;">
            <tr>
              <td style="padding: 6px 0; color: #6b7280; width: 140px;">Customer Name:</td>
              <td style="padding: 6px 0; font-weight: 600; color: #111827;">${escapeHtml(name)}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #6b7280;">Email Address:</td>
              <td style="padding: 6px 0; font-weight: 500; color: #166534;">
                <a href="mailto:${escapeHtml(email)}" style="color: #166534; text-decoration: none;">${escapeHtml(email)}</a>
              </td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #6b7280;">Phone Number:</td>
              <td style="padding: 6px 0; color: #374151;">${escapeHtml(phone)}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #6b7280;">Subject:</td>
              <td style="padding: 6px 0; font-weight: 600; color: #111827;">${escapeHtml(subjectLine)}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #6b7280;">Submitted At:</td>
              <td style="padding: 6px 0; color: #374151;">${escapeHtml(formatDateTime(submittedAt))}</td>
            </tr>
          </table>
        </div>

        <h3 style="margin: 0 0 10px 0; font-size: 15px; font-weight: 600; color: #374151;">Inquiry Message:</h3>
        <div style="background-color: #ffffff; border: 1px solid #e5e7eb; border-left: 4px solid #166534; border-radius: 4px; padding: 16px; margin-bottom: 20px; font-size: 14px; color: #1f2937; line-height: 1.6; white-space: pre-wrap;">
${escapeHtml(message)}
        </div>
      `;

      const subject = `[AgrivaFoods Admin] New Customer Inquiry: ${subjectLine}`;
      const text = `
=== AGRIVAFOODS ADMIN: NEW CUSTOMER INQUIRY ===

A visitor has submitted a contact inquiry:

- Name: ${name}
- Email: ${email}
- Phone: ${phone}
- Subject: ${subjectLine}
- Inquiry ID: ${inquiryId}
- Submitted: ${formatDateTime(submittedAt)}

Message:
----------------------------------------
${message}
----------------------------------------

Admin Dashboard:
${env.CLIENT_URL}/admin
      `.trim();

      const html = this.renderEmailLayout({
        badgeText: 'New Inquiry',
        badgeColor: '#15803d',
        title: `Customer Inquiry: ${subjectLine}`,
        subtitle: `A new message was submitted via the Contact Us form by ${name}.`,
        contentHtml,
        ctaText: 'View Inquiries in Admin',
        ctaUrl: `/admin`
      });

      return await this.sendAdminEmail({ subject, html, text });
    } catch (err) {
      logger.error(`[EmailService] Error preparing inquiry email: ${err.message}`);
      return { success: false, error: err.message };
    }
  }
}

export const emailService = new EmailService();
