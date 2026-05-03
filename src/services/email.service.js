const nodemailer = require('nodemailer');
const config = require('../config/env');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: {
        user: config.smtp.user,
        pass: config.smtp.pass,
      },
    });
  }

  async sendEmail({ to, subject, text, html, from = null }) {
    try {
      const mailOptions = {
        from: from || config.smtp.user,
        to,
        subject,
        text,
        html: html || text,
      };

      const info = await this.transporter.sendMail(mailOptions);

      return {
        success: true,
        messageId: info.messageId,
        response: info.response,
      };
    } catch (error) {
      console.error('Email sending error:', error);
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
      await this.transporter.verify();
      return { success: true, message: 'SMTP connection verified' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }
}

module.exports = new EmailService();
