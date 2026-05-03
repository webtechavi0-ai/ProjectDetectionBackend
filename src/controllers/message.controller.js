const Message = require('../models/Message');
const Business = require('../models/Business');
const openRouterService = require('../services/openrouter.service');
const emailService = require('../services/email.service');

exports.generateMessage = async (req, res, next) => {
  try {
    const { businessId, userGoal } = req.body;

    const business = await Business.findById(businessId);
    if (!business) {
      return res.status(404).json({
        success: false,
        message: 'Business not found',
      });
    }

    const [summaryResult, outreachResult] = await Promise.allSettled([
      openRouterService.generateBusinessSummary(business),
      openRouterService.generateOutreachMessage(business, userGoal),
    ]);

    const summary = summaryResult.status === 'fulfilled' ? summaryResult.value : null;
    const outreachMessage = outreachResult.status === 'fulfilled' ? outreachResult.value : null;

    if (!outreachMessage) {
      const reason = outreachResult.reason?.message || 'AI returned empty response';
      return res.status(502).json({ success: false, message: `Message generation failed: ${reason}` });
    }

    res.json({
      success: true,
      data: {
        businessId: business._id,
        businessName: business.name,
        summary,
        message: outreachMessage,
        suggestedSubject: `Partnership Opportunity with ${business.name}`,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.sendMessage = async (req, res, next) => {
  try {
    const { businessId, channel, content, subject, recipient } = req.body;

    const business = await Business.findById(businessId);
    if (!business) {
      return res.status(404).json({
        success: false,
        message: 'Business not found',
      });
    }

    const message = await Message.create({
      user: req.user.id,
      business: businessId,
      channel,
      recipient: {
        email: recipient?.email || business.email,
        phone: recipient?.phone || business.phone,
      },
      subject,
      content,
      aiGenerated: req.body.aiGenerated || false,
      aiModel: req.body.aiModel,
      status: 'draft',
    });

    let sendResult;
    try {
      if (channel === 'email') {
        if (!message.recipient.email) {
          throw new Error('No email address available for this business');
        }

        sendResult = await emailService.sendOutreachEmail(
          message.recipient.email,
          subject || `Business Inquiry - ${business.name}`,
          content,
          business.name
        );

        message.status = 'sent';
        message.metadata = {
          sentAt: new Date(),
          provider: 'smtp',
          messageId: sendResult.messageId,
        };
      } else if (channel === 'sms') {
        throw new Error('SMS sending not yet implemented. Please configure Twilio.');
      } else if (channel === 'whatsapp') {
        throw new Error('WhatsApp sending not yet implemented. Please configure WhatsApp Business API.');
      }

      await message.save();

      res.json({
        success: true,
        data: {
          message: {
            id: message._id,
            status: message.status,
            channel: message.channel,
            sentAt: message.metadata.sentAt,
          },
        },
      });
    } catch (sendError) {
      message.status = 'failed';
      message.metadata = {
        errorMessage: sendError.message,
      };
      await message.save();

      throw sendError;
    }
  } catch (error) {
    next(error);
  }
};

exports.bulkSendMessages = async (req, res, next) => {
  try {
    const { businessIds, content, subject, channel = 'email', userGoal } = req.body;

    if (!businessIds || !Array.isArray(businessIds) || businessIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an array of business IDs',
      });
    }

    const businesses = await Business.find({ _id: { $in: businessIds } });

    let messages;
    if (content) {
      messages = businesses.map((b) => ({
        business: b,
        content,
        subject: subject || `Business Inquiry - ${b.name}`,
      }));
    } else {
      const aiMessages = await openRouterService.generateBulkOutreach(businesses, userGoal);
      messages = aiMessages
        .filter((m) => m.success)
        .map((m) => {
          const business = businesses.find((b) => b._id.toString() === m.businessId.toString());
          return {
            business,
            content: m.message,
            subject: subject || `Partnership Opportunity with ${business.name}`,
          };
        });
    }

    const results = await Promise.allSettled(
      messages.map(async ({ business, content, subject }) => {
        const message = await Message.create({
          user: req.user.id,
          business: business._id,
          channel,
          recipient: {
            email: business.email,
            phone: business.phone,
          },
          subject,
          content,
          aiGenerated: !req.body.content,
          status: 'draft',
        });

        if (channel === 'email' && business.email) {
          const sendResult = await emailService.sendOutreachEmail(
            business.email,
            subject,
            content,
            business.name
          );

          message.status = 'sent';
          message.metadata = {
            sentAt: new Date(),
            provider: 'smtp',
            messageId: sendResult.messageId,
          };
          await message.save();

          return { businessId: business._id, businessName: business.name, success: true };
        } else {
          throw new Error('No email available or unsupported channel');
        }
      })
    );

    const summary = {
      total: results.length,
      sent: results.filter((r) => r.status === 'fulfilled').length,
      failed: results.filter((r) => r.status === 'rejected').length,
    };

    res.json({
      success: true,
      data: {
        summary,
        results: results.map((r, i) => ({
          business: messages[i].business.name,
          success: r.status === 'fulfilled',
          error: r.status === 'rejected' ? r.reason.message : null,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.getMessages = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, channel } = req.query;

    const query = { user: req.user.id };
    if (status) query.status = status;
    if (channel) query.channel = channel;

    const messages = await Message.find(query)
      .populate('business', 'name address category')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const count = await Message.countDocuments(query);

    res.json({
      success: true,
      data: {
        messages,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        total: count,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.getMessageById = async (req, res, next) => {
  try {
    const message = await Message.findOne({
      _id: req.params.id,
      user: req.user.id,
    }).populate('business');

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found',
      });
    }

    res.json({
      success: true,
      data: { message },
    });
  } catch (error) {
    next(error);
  }
};
