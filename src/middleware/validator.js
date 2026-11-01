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
  query('keyword')
    .if(query('location').not().exists({ checkFalsy: true }))
    .notEmpty()
    .withMessage('Keyword or location is required'),
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
  body('userGoal').optional({ values: 'null' }).isString(),
];
