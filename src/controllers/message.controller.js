const Message = require('../models/Message');
const Business = require('../models/Business');
const anthropicService = require('../services/anthropic.service');
const emailService = require('../services/email.service');
const { schoolBusinessId } = require('../config/pinnedBusiness');

// Used whenever AI generation is unavailable or returns nothing, so every business still gets a message.
const buildFallbackMessage = (business, userGoal) => {
  const goal = typeof userGoal === 'string' ? userGoal.trim() : '';
  const offer = goal
    ? `I'm reaching out to ${goal}. Would you also like to modify or improve your website, app, or any other part of your online presence?`
    : `Would you like to modify or improve your website, app, or any other part of your online presence? We help businesses like yours with redesigns, new features, performance improvements and more.`;

  return `Hi ${business.name} team,

I came across ${business.name} and was impressed by what you've built. ${offer}

If you're interested, just reply to this message and we'll set up a quick call to discuss what you need.

Looking forward to hearing from you.`;
};

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
      anthropicService.generateBusinessSummary(business),
      anthropicService.generateOutreachMessage(business, userGoal),
    ]);

    const summary = summaryResult.status === 'fulfilled' ? summaryResult.value : null;
    const outreachMessage = outreachResult.status === 'fulfilled' ? outreachResult.value : null;

    const aiGenerated = Boolean(outreachMessage);

    res.json({
      success: true,
      data: {
        businessId: business._id,
        businessName: business.name,
        summary,
        message: outreachMessage || buildFallbackMessage(business, userGoal),
        aiGenerated,
        suggestedSubject: aiGenerated
          ? `Partnership Opportunity with ${business.name}`
          : `Want to improve ${business.name}'s website or app?`,
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
          provider: 'brevo',
          messageId: sendResult.messageId,
        };
      } else if (channel === 'sms') {
        throw new Error('SMS sending not yet implemented. Please configure Twilio.');
      } else {
        throw new Error('Unsupported message channel');
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

    if (channel !== 'email') {
      return res.status(400).json({
        success: false,
        message: 'Bulk sending is currently available for email only.',
      });
    }

    const requestedIds = [...new Set(businessIds.map((id) => id.toString()))];
    const orderedIds = [
      schoolBusinessId,
      ...requestedIds.filter((id) => id !== schoolBusinessId),
    ];
    const fetchedBusinesses = await Business.find({ _id: { $in: orderedIds } });
    const businessesById = new Map(
      fetchedBusinesses.map((business) => [business._id.toString(), business])
    );
    if (!businessesById.has(schoolBusinessId)) {
      return res.status(500).json({
        success: false,
        message: 'Configured school business was not found',
      });
    }
    const businesses = orderedIds
      .map((id) => businessesById.get(id))
      .filter(Boolean);

    let messages;
    if (content) {
      messages = businesses.map((b) => ({
        business: b,
        content,
        subject: subject || `Business Inquiry - ${b.name}`,
        aiGenerated: false,
      }));
    } else {
      const aiMessages = await anthropicService
        .generateBulkOutreach(businesses, userGoal)
        .catch(() => []);
      const aiByBusiness = new Map(
        aiMessages
          .filter((m) => m.success && m.message)
          .map((m) => [m.businessId.toString(), m.message])
      );

      // Every selected business gets a message; fall back to the default one when AI produced none.
      messages = businesses.map((business) => {
        const aiMessage = aiByBusiness.get(business._id.toString());
        return {
          business,
          content: aiMessage || buildFallbackMessage(business, userGoal),
          subject:
            subject ||
            (aiMessage
              ? `Partnership Opportunity with ${business.name}`
              : `Want to improve ${business.name}'s website or app?`),
          aiGenerated: Boolean(aiMessage),
        };
      });
    }

    const results = await Promise.allSettled(
      messages.map(async ({ business, content, subject, aiGenerated }) => {
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
          aiGenerated,
          status: 'draft',
        });

        try {
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
              provider: 'brevo',
              messageId: sendResult.messageId,
            };
          } else if (channel === 'email') {
            throw new Error('No email available for this business');
          } else {
            throw new Error('Unsupported channel');
          }

          await message.save();
          return { businessId: business._id, businessName: business.name, success: true };
        } catch (error) {
          message.status = 'failed';
          message.metadata = { errorMessage: error.message };
          await message.save();
          throw error;
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
