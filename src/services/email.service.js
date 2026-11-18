const config = require('../config/env');

const BREVO_EMAIL_URL = 'https://api.brevo.com/v3/smtp/email';
const BREVO_ACCOUNT_URL = 'https://api.brevo.com/v3/account';

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

      if (!response.ok) {
        throw new Error(
          result.message || `Brevo API request failed (${response.status}): ${responseBody}`
        );
      }

      return {
        success: true,
        messageId: result.messageId,
        response: responseBody,
      };
    } catch (error) {
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }

  async sendOutreachEmail(recipientEmail, subject, message, businessName) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9fafb; }
          .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Business Outreach</h2>
          </div>
          <div class="content">
            <p>Dear ${businessName} Team,</p>
            ${message.split('\n').map(para => `<p>${para}</p>`).join('')}
          </div>
          <div class="footer">
            <p>This email was sent via Geo Outreach Platform</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail({
      to: recipientEmail,
      subject,
      text: message,
      html,
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
        return { success: false, message: 'BREVO_API_KEY is not configured' };
      }

      const response = await fetch(BREVO_ACCOUNT_URL, {
        headers: {
          accept: 'application/json',
          'api-key': config.brevo.apiKey,
        },
      });
      if (!response.ok) {
        return {
          success: false,
          message: `Brevo API verification failed (${response.status})`,
        };
      }

      return { success: true, message: 'Brevo API connection verified' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }
}

module.exports = new EmailService();
