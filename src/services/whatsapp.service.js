const axios = require('axios');
const config = require('../config/env');

const toWhatsAppAddress = (phone, label = 'Phone number') => {
  if (typeof phone !== 'string') {
    throw new Error(`${label} must be in E.164 format, including the country code.`);
  }

  const normalized = phone
    .trim()
    .replace(/^whatsapp:/i, '')
    .replace(/[\s().-]/g, '');

  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
    throw new Error(`${label} must be in E.164 format, including the country code.`);
  }

  return `whatsapp:${normalized}`;
};

const getConfigurationError = () => {
  const missing = [
    ['TWILIO_ACCOUNT_SID', config.twilio.accountSid],
    ['TWILIO_AUTH_TOKEN', config.twilio.authToken],
    ['TWILIO_PHONE_NUMBER', config.twilio.phoneNumber],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length) {
    return `WhatsApp is not configured. Set ${missing.join(', ')} in the backend .env file.`;
  }

  try {
    toWhatsAppAddress(config.twilio.phoneNumber, 'TWILIO_PHONE_NUMBER');
  } catch {
    return 'TWILIO_PHONE_NUMBER must be a WhatsApp-enabled number in E.164 format.';
  }

  return null;
};

const sendWhatsAppMessage = async ({ to, body }) => {
  const configurationError = getConfigurationError();
  if (configurationError) {
    throw new Error(configurationError);
  }

  const accountSid = config.twilio.accountSid;
  const form = new URLSearchParams({
    From: toWhatsAppAddress(config.twilio.phoneNumber, 'TWILIO_PHONE_NUMBER'),
    To: toWhatsAppAddress(to, 'Recipient phone number'),
    Body: body,
  });

  try {
    const response = await axios.post(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`,
      form.toString(),
      {
        auth: {
          username: accountSid,
          password: config.twilio.authToken,
        },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 15000,
      }
    );

    return {
      messageId: response.data.sid,
      status: response.data.status,
    };
  } catch (error) {
    const providerMessage = error.response?.data?.message || error.message;
    throw new Error(`Twilio WhatsApp send failed: ${providerMessage}`);
  }
};

module.exports = {
  getConfigurationError,
  sendWhatsAppMessage,
  toWhatsAppAddress,
};
