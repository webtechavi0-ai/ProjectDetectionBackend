const express = require('express');
const router = express.Router();
const {
  searchBusinesses,
  getBusinessDetails,
  getSearchHistory,
} = require('../controllers/search.controller');
const { protect } = require('../middleware/auth');
const { searchLimiter } = require('../middleware/rateLimiter');
const { searchValidation, validate } = require('../middleware/validator');

router.get('/', protect, searchLimiter, searchValidation, validate, searchBusinesses);
router.get('/history', protect, getSearchHistory);
router.get('/business/:id', protect, getBusinessDetails);

module.exports = router;
