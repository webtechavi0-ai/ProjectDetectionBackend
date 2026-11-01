const mongoose = require('mongoose');

const businessSchema = new mongoose.Schema({
  placeId: {
    type: String,
    required: true,
    unique: true,
  },
  name: {
    type: String,
    required: true,
  },
  address: {
    formatted: String,
    street: String,
    city: String,
    state: String,
    country: String,
    postalCode: String,
  },
  // Optional: Play Store apps have no coordinates.
  location: {
    type: {
      type: String,
      enum: ['Point'],
    },
    coordinates: { type: [Number], default: undefined },
  },
  developer: String,
  summary: String,
  installs: String,
  icon: String,
  url: String,
  reviews: [
    {
      authorName: String,
      rating: Number,
      text: String,
      time: Number,
      profilePhotoUrl: String,
    },
  ],
  category: {
    type: String,
    required: true,
  },
  types: [String],
  phone: String,
  email: String,
  website: String,
  rating: {
    type: Number,
    min: 0,
    max: 5,
  },
  totalRatings: Number,
  priceLevel: {
    type: Number,
    min: 0,
    max: 4,
  },
  openingHours: {
    isOpen: Boolean,
    weekdayText: [String],
  },
  photos: [
    {
      reference: String,
      width: Number,
      height: Number,
    },
  ],
  metadata: {
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
    source: {
      type: String,
      default: 'google_play',
    },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

businessSchema.index({ location: '2dsphere' });
businessSchema.index({ category: 1 });

module.exports = mongoose.model('Business', businessSchema);
