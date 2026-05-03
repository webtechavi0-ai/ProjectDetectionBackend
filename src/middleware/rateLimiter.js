const rateLimit = require('express-rate-limit');
const config = require('../config/env');

const createRateLimiter = (windowMs, max, message) => {
  return rateLimit({
    windowMs: windowMs || config.rateLimiting.windowMs,
    max: max || config.rateLimiting.maxRequests,
    message: message || 'Too many requests from this IP, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
  });
};

exports.generalLimiter = createRateLimiter();

exports.authLimiter = createRateLimiter(
  15 * 60 * 1000,
  15,
  'Too many authentication attempts, please try again after 15 minutes'
);

exports.searchLimiter = createRateLimiter(
  60 * 1000,
  20,
  'Too many search requests, please try again after a minute'
);

exports.messageLimiter = createRateLimiter(
  60 * 60 * 1000,
  50,
  'Too many messages sent, please try again after an hour'
);
