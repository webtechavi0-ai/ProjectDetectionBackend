const mongoose = require('mongoose');

const searchSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number],
      required: true,
    },
    address: {
      type: String,
      required: true,
    },
  },
  radius: {
    type: Number,
    required: true,
    min: 0.1,
    max: 50,
  },
  filters: {
    category: [String],
    minRating: Number,
    openNow: Boolean,
  },
  resultsCount: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

searchSchema.index({ location: '2dsphere' });
searchSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('Search', searchSchema);
