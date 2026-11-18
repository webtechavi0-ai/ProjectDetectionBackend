jest.mock('axios');

const axios = require('axios');
const config = require('../config/env');
const {
  getConfigurationError,
  sendWhatsAppMessage,
  toWhatsAppAddress,
} = require('./whatsapp.service');

const originalTwilioConfig = { ...config.twilio };

beforeEach(() => {
  Object.assign(config.twilio, {
    accountSid: 'AC123',
    authToken: 'test-token',
    phoneNumber: '+919196431225',
  });
  axios.post.mockReset();
});

afterAll(() => {
  Object.assign(config.twilio, originalTwilioConfig);
});

describe('WhatsApp service', () => {
  it('formats valid phone numbers as WhatsApp addresses', () => {
    expect(toWhatsAppAddress('+1 (415) 555-2671')).toBe('whatsapp:+14155552671');
  });

  it('rejects numbers without an explicit country code', () => {
    expect(() => toWhatsAppAddress('9196431225')).toThrow('E.164 format');
  });

  it('posts the message to Twilio and returns its provider ID', async () => {
    axios.post.mockResolvedValue({
      data: { sid: 'SM123', status: 'queued' },
    });

    await expect(
      sendWhatsAppMessage({
        to: '+14155552671',
        body: 'Hello',
      })
    ).resolves.toEqual({ messageId: 'SM123', status: 'queued' });

    const [url, body, options] = axios.post.mock.calls[0];
    expect(url).toContain('/Accounts/AC123/Messages.json');
    expect(new URLSearchParams(body).get('From')).toBe('whatsapp:+919196431225');
    expect(new URLSearchParams(body).get('To')).toBe('whatsapp:+14155552671');
    expect(new URLSearchParams(body).get('Body')).toBe('Hello');
    expect(options.auth).toEqual({ username: 'AC123', password: 'test-token' });
  });

  it('reports missing Twilio credentials before attempting to send', async () => {
    config.twilio.authToken = '';

    expect(getConfigurationError()).toContain('TWILIO_AUTH_TOKEN');
    await expect(
      sendWhatsAppMessage({ to: '+14155552671', body: 'Hello' })
    ).rejects.toThrow('TWILIO_AUTH_TOKEN');
    expect(axios.post).not.toHaveBeenCalled();
  });
});
