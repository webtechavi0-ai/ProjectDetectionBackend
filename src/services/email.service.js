const config = require('../config/env');

const BREVO_EMAIL_URL = 'https://api.brevo.com/v3/smtp/email';
const BREVO_ACCOUNT_URL = 'https://api.brevo.com/v3/account';
const LOG_PREFIX = '[BrevoEmail]';

const parseSender = (sender) => {
  const formattedSender = /^\s*(.*?)\s*<([^<>]+)>\s*$/.exec(sender);
  if (formattedSender) {
    return {
      name: formattedSender[1] || 'Geo Outreach',
      email: formattedSender[2].trim(),
    };
  }

  return { name: 'Geo Outreach', email: sender.trim() };
};

const htmlToText = (html) =>
  html
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<\/(p|div|h[1-6]|br|li|tr|body)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const buildOutreachHtml = (businessName, message) => {
  const safeBusinessName = escapeHtml(businessName || 'there');
  const messageParagraphs = String(message)
    .split(/\r?\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map(
      (paragraph) =>
        `<p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.75;">${escapeHtml(paragraph)}</p>`
    )
    .join('');

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        @media only screen and (max-width: 600px) {
          .email-card { width: 100% !important; }
          .email-content { padding: 28px 22px !important; }
        }
      </style>
    </head>
    <body style="margin:0;padding:0;background-color:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
      <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
        A thoughtful note from the Geo Outreach team.
      </div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f1f5f9;">
        <tr>
          <td align="center" style="padding:36px 14px;">
            <table role="presentation" class="email-card" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
              <tr>
                <td style="padding:24px 32px;background-color:#0f172a;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td width="42" valign="middle">
                        <div style="width:36px;height:36px;border-radius:10px;background-color:#6366f1;color:#ffffff;font-size:18px;font-weight:bold;line-height:36px;text-align:center;">G</div>
                      </td>
                      <td valign="middle" style="padding-left:12px;color:#ffffff;font-size:16px;font-weight:bold;letter-spacing:0.3px;">GEO OUTREACH</td>
                      <td align="right" valign="middle" style="color:#cbd5e1;font-size:12px;">Business introductions</td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td class="email-content" style="padding:40px 42px 32px;">
                  <p style="margin:0 0 12px;color:#6366f1;font-size:12px;font-weight:bold;letter-spacing:1.4px;text-transform:uppercase;">A personal note</p>
                  <h1 style="margin:0 0 10px;color:#0f172a;font-size:28px;line-height:1.25;font-weight:700;">Hello ${safeBusinessName} team</h1>
                  <p style="margin:0 0 28px;color:#64748b;font-size:15px;line-height:1.6;">We’d love to explore how we can support your next step.</p>
                  <div style="padding:24px;background-color:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #6366f1;border-radius:10px;">
                    ${messageParagraphs}
                  </div>
                  <p style="margin:28px 0 0;color:#334155;font-size:15px;line-height:1.7;">Warm regards,<br><strong style="color:#0f172a;">The Geo Outreach Team</strong></p>
                </td>
              </tr>
              <tr>
                <td style="padding:20px 32px;background-color:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
                  <p style="margin:0;color:#64748b;font-size:12px;line-height:1.6;">This email was sent via Geo Outreach Platform.</p>
                  <p style="margin:6px 0 0;color:#94a3b8;font-size:11px;">Thoughtful conversations. Better digital experiences.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
};

class EmailService {
  async sendEmail({ to, subject, text, html, from = null }) {
    try {
      if (!config.brevo.apiKey) {
        throw new Error('BREVO_API_KEY is not configured');
      }

      const senderAddress = from || config.brevo.emailFrom;
      if (!senderAddress) {
        throw new Error('EMAIL_FROM is not configured');
      }

      console.info(`${LOG_PREFIX} Submitting email`, { recipientCount: 1 });
      const response = await fetch(BREVO_EMAIL_URL, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'api-key': config.brevo.apiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          sender: parseSender(senderAddress),
          to: [{ email: to }],
          subject,
          textContent: text,
          htmlContent: html || text,
        }),
      });

      const responseBody = await response.text();
      let result = {};
      if (responseBody) {
        try {
          const parsedResult = JSON.parse(responseBody);
          if (parsedResult && typeof parsedResult === 'object') {
            result = parsedResult;
          }
        } catch {
          result = {};
        }
      }

      console.info(`${LOG_PREFIX} API response`, {
        status: response.status,
        accepted: response.ok,
        messageId: result.messageId || null,
      });

      if (!response.ok) {
        throw new Error(result.message || `Brevo API request failed (${response.status})`);
      }

      return {
        success: true,
        messageId: result.messageId,
        response: responseBody,
      };
    } catch (error) {
      console.error(`${LOG_PREFIX} Send failed`, { error: error.message });
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }

  async sendOutreachEmail(recipientEmail, subject, message, businessName) {
    const containsHtml = /<!doctype\s+html|<html\b|<body\b|<div\b|<p\b/i.test(message);
    if (containsHtml) {
      return this.sendEmail({
        to: recipientEmail,
        subject,
        text: htmlToText(message),
        html: message,
      });
    }

    return await this.sendEmail({
      to: recipientEmail,
      subject,
      text: message,
      html: buildOutreachHtml(businessName, message),
    });
  }

  async sendBulkEmails(emails) {
    const results = await Promise.allSettled(
      emails.map(async (email) => {
        return await this.sendOutreachEmail(
          email.to,
          email.subject,
          email.message,
          email.businessName
        );
      })
    );

    return results.map((result, index) => ({
      email: emails[index].to,
      success: result.status === 'fulfilled',
      result: result.status === 'fulfilled' ? result.value : null,
      error: result.status === 'rejected' ? result.reason.message : null,
    }));
  }

  async verifyConnection() {
    try {
      if (!config.brevo.apiKey) {
        console.error(`${LOG_PREFIX} Verification failed: BREVO_API_KEY is not configured`);
        return { success: false, message: 'BREVO_API_KEY is not configured' };
      }

      console.info(`${LOG_PREFIX} Verifying API connection`);
      const response = await fetch(BREVO_ACCOUNT_URL, {
        headers: {
          accept: 'application/json',
          'api-key': config.brevo.apiKey,
        },
      });
      console.info(`${LOG_PREFIX} Verification response`, {
        status: response.status,
        accepted: response.ok,
      });
      if (!response.ok) {
        return {
          success: false,
          message: `Brevo API verification failed (${response.status})`,
        };
      }

      return { success: true, message: 'Brevo API connection verified' };
    } catch (error) {
      console.error(`${LOG_PREFIX} Verification failed`, { error: error.message });
      return { success: false, message: error.message };
    }
  }
}

module.exports = new EmailService();
