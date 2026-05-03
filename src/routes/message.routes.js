const express = require('express');
const router = express.Router();
const {
  generateMessage,
  sendMessage,
  bulkSendMessages,
  getMessages,
  getMessageById,
} = require('../controllers/message.controller');
const { protect } = require('../middleware/auth');
const { messageLimiter } = require('../middleware/rateLimiter');
const {
  messageValidation,
  generateMessageValidation,
  validate,
} = require('../middleware/validator');

router.post(
  '/generate',
  protect,
  generateMessageValidation,
  validate,
  generateMessage
);
router.post('/send', protect, messageLimiter, messageValidation, validate, sendMessage);
router.post('/bulk-send', protect, messageLimiter, bulkSendMessages);
router.get('/', protect, getMessages);
router.get('/:id', protect, getMessageById);

module.exports = router;
