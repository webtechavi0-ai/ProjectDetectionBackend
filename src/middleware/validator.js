const { body, param, query, validationResult } = require('express-validator');

exports.validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array(),
    });
  }
  next();
};

exports.registerValidation = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
];

exports.loginValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

exports.searchValidation = [
  query('location').notEmpty().withMessage('Location is required'),
  query('radius')
    .isFloat({ min: 0.1, max: 50 })
    .withMessage('Radius must be between 0.1 and 50 km'),
];

exports.messageValidation = [
  body('businessId').notEmpty().withMessage('Business ID is required'),
  body('channel')
    .isIn(['email', 'sms', 'whatsapp'])
    .withMessage('Invalid channel'),
  body('content').notEmpty().withMessage('Message content is required'),
];

exports.generateMessageValidation = [
  body('businessId').notEmpty().withMessage('Business ID is required'),
  body('userGoal').optional().isString(),
];
