const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getDashboard,
  getUserSearches,
  getUserMessages,
  getAllMessages,
  updateMessage,
  deleteMessage,
  deleteUser,
  getAllSearches,
  deleteSearch,
} = require('../controllers/admin.controller');

// All admin routes require auth + admin role
router.use(protect);
router.use(authorize('admin'));

router.get('/dashboard', getDashboard);
router.get('/searches', getAllSearches);
router.delete('/searches/:id', deleteSearch);
router.get('/messages', getAllMessages);
router.put('/messages/:id', updateMessage);
router.delete('/messages/:id', deleteMessage);
router.get('/users/:userId/searches', getUserSearches);
router.get('/users/:userId/messages', getUserMessages);
router.delete('/users/:userId', deleteUser);

module.exports = router;
