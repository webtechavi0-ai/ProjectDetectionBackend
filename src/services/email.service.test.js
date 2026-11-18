const config = require('../config/env');
const emailService = require('./email.service');

const originalApiKey = config.brevo.apiKey;
const originalEmailFrom = config.brevo.emailFrom;
const originalFetch = global.fetch;

describe('Brevo email service', () => {
  let infoSpy;
  let errorSpy;

  beforeEach(() => {
    config.brevo.apiKey = 'test-api-key';
    config.brevo.emailFrom = 'SoulSync <verified@example.com>';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      text: jest.fn().mockResolvedValue('{"messageId":"message-id"}'),
    });
    infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    infoSpy.mockRestore();
    errorSpy.mockRestore();
  });

  afterAll(() => {
    config.brevo.apiKey = originalApiKey;
    config.brevo.emailFrom = originalEmailFrom;
    global.fetch = originalFetch;
  });

  it('submits the email and logs the provider response without message content', async () => {
    const result = await emailService.sendEmail({
      to: 'recipient@example.com',
      subject: 'Test',
      text: 'Private test content',
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.brevo.com/v3/smtp/email',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'api-key': 'test-api-key' }),
        body: expect.stringContaining('"email":"recipient@example.com"'),
      })
    );
    expect(result.messageId).toBe('message-id');
    expect(infoSpy).toHaveBeenCalledWith('[BrevoEmail] API response', {
      status: 201,
      accepted: true,
      messageId: 'message-id',
    });
    expect(JSON.stringify(infoSpy.mock.calls)).not.toContain('Private test content');
    expect(JSON.stringify(infoSpy.mock.calls)).not.toContain('test-api-key');
  });

  it('passes full HTML content to Brevo without wrapping it again', async () => {
    const html = '<!DOCTYPE html><html><body><p>Static HTML body</p></body></html>';

    await emailService.sendOutreachEmail(
      'recipient@example.com',
      'HTML test',
      html,
      'Email Test Business'
    );

    const requestBody = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(requestBody.htmlContent).toBe(html);
    expect(requestBody.textContent).toBe('Static HTML body');
  });

  it('renders plain-text outreach in a polished layout and escapes HTML characters', async () => {
    await emailService.sendOutreachEmail(
      'recipient@example.com',
      'Design test',
      '<script>alert("x")</script>\nA second paragraph.',
      '<Acme>'
    );

    const requestBody = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(requestBody.htmlContent).toContain('class="email-card"');
    expect(requestBody.htmlContent).toContain('Hello &lt;Acme&gt; team');
    expect(requestBody.htmlContent).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
    expect(requestBody.htmlContent).not.toContain('<script>alert("x")</script>');
    expect(requestBody.textContent).toBe('<script>alert("x")</script>\nA second paragraph.');
  });

  it('logs a clear error and skips the API request when the key is missing', async () => {
    config.brevo.apiKey = '';

    await expect(
      emailService.sendEmail({
        to: 'recipient@example.com',
        subject: 'Test',
        text: 'Hello',
      })
    ).rejects.toThrow('BREVO_API_KEY is not configured');

    expect(global.fetch).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith('[BrevoEmail] Send failed', {
      error: 'BREVO_API_KEY is not configured',
    });
  });

  it('logs the result of the Brevo API connection check', async () => {
    const result = await emailService.verifyConnection();

    expect(result.success).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.brevo.com/v3/account',
      expect.any(Object)
    );
    expect(infoSpy).toHaveBeenCalledWith('[BrevoEmail] Verification response', {
      status: 201,
      accepted: true,
    });
  });
});
