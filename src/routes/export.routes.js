const express = require('express');
const router = express.Router();
const { exportLeads, getStats } = require('../controllers/export.controller');
const { protect } = require('../middleware/auth');

router.get('/leads', protect, exportLeads);
router.get('/stats', protect, getStats);

module.exports = router;
