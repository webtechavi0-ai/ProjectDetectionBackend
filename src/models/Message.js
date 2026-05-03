const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  business: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Business',
    required: true,
  },
  search: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Search',
  },
  channel: {
    type: String,
    enum: ['email', 'sms', 'whatsapp'],
    required: true,
  },
  recipient: {
    email: String,
    phone: String,
  },
  subject: String,
  content: {
    type: String,
    required: true,
  },
  aiGenerated: {
    type: Boolean,
    default: false,
  },
  aiModel: String,
  status: {
    type: String,
    enum: ['draft', 'sent', 'failed', 'delivered', 'opened'],
    default: 'draft',
  },
  metadata: {
    sentAt: Date,
    deliveredAt: Date,
    openedAt: Date,
    errorMessage: String,
    provider: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

messageSchema.index({ user: 1, createdAt: -1 });
messageSchema.index({ business: 1 });
messageSchema.index({ status: 1 });

messageSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Message', messageSchema);
