jest.mock('../models/Message', () => ({
  create: jest.fn(),
}));
jest.mock('../models/Business', () => ({
  find: jest.fn(),
}));
jest.mock('../services/anthropic.service', () => ({
  generateBulkOutreach: jest.fn(),
}));
jest.mock('../services/email.service', () => ({
  sendOutreachEmail: jest.fn(),
}));

const Message = require('../models/Message');
const Business = require('../models/Business');
const emailService = require('../services/email.service');
const { bulkSendMessages } = require('./message.controller');
const { schoolBusinessId } = require('../config/pinnedBusiness');

describe('bulkSendMessages', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    emailService.sendOutreachEmail.mockResolvedValue({ messageId: 'message-id' });
    Message.create.mockImplementation(async (message) => ({
      ...message,
      metadata: {},
      save: jest.fn().mockResolvedValue(),
    }));
  });

  it('sends the pinned school first exactly once along with selected businesses', async () => {
    const otherBusinessId = '507f1f77bcf86cd799439011';
    const school = {
      _id: { toString: () => schoolBusinessId },
      name: 'Email Test Business',
      email: 'webtechavi0@gmail.com',
    };
    const otherBusiness = {
      _id: { toString: () => otherBusinessId },
      name: 'Selected Business',
      email: 'selected@example.com',
    };
    Business.find.mockResolvedValue([otherBusiness, school]);
    const req = {
      user: { id: 'user-id' },
      body: {
        businessIds: [otherBusinessId, schoolBusinessId, otherBusinessId],
        channel: 'email',
        content: 'Test message',
      },
    };
    const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
    const next = jest.fn();

    await bulkSendMessages(req, res, next);

    expect(Business.find).toHaveBeenCalledWith({
      _id: { $in: [schoolBusinessId, otherBusinessId] },
    });
    expect(emailService.sendOutreachEmail.mock.calls.map(([email]) => email)).toEqual([
      'webtechavi0@gmail.com',
      'selected@example.com',
    ]);
    expect(res.json.mock.calls[0][0].data.results.map((result) => result.business)).toEqual([
      'Email Test Business',
      'Selected Business',
    ]);
    expect(next).not.toHaveBeenCalled();
  });
});
