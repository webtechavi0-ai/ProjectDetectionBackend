const User = require('../models/User');
const Search = require('../models/Search');
const Message = require('../models/Message');
const Business = require('../models/Business');

// GET /api/admin/dashboard - Admin overview stats
exports.getDashboard = async (req, res, next) => {
  try {
    const totalUsers = await User.countDocuments({ role: 'user' });
    const totalSearches = await Search.countDocuments();
    const totalMessages = await Message.countDocuments();
    const sentMessages = await Message.countDocuments({ status: 'sent' });
    const totalBusinesses = await Business.countDocuments();

    const users = await User.find({ role: 'user' })
      .select('name email company createdAt')
      .sort({ createdAt: -1 })
      .lean();

    // Per-user stats
    const userStats = await Promise.all(
      users.map(async (user) => {
        const searches = await Search.countDocuments({ user: user._id });
        const messages = await Message.countDocuments({ user: user._id });
        const sent = await Message.countDocuments({ user: user._id, status: 'sent' });
        return {
          ...user,
          searches,
          messages,
          sent,
        };
      })
    );

    res.json({
      success: true,
      data: {
        overview: {
          totalUsers,
          totalSearches,
          totalMessages,
          sentMessages,
          totalBusinesses,
        },
        users: userStats,
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/admin/users/:userId/searches - User's search history
exports.getUserSearches = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const searches = await Search.find({ user: userId })
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, data: { searches } });
  } catch (error) {
    next(error);
  }
};

// GET /api/admin/users/:userId/messages - User's messages
exports.getUserMessages = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const messages = await Message.find({ user: userId })
      .populate('business', 'name email phone address')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, data: { messages } });
  } catch (error) {
    next(error);
  }
};

// GET /api/admin/messages - All messages
exports.getAllMessages = async (req, res, next) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const messages = await Message.find()
      .populate('user', 'name email')
      .populate('business', 'name email phone address')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await Message.countDocuments();

    res.json({
      success: true,
      data: {
        messages,
        total,
        totalPages: Math.ceil(total / limit),
        currentPage: Number(page),
      },
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/admin/messages/:id - Edit a message
exports.updateMessage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { content, subject, status } = req.body;

    const message = await Message.findByIdAndUpdate(
      id,
      { content, subject, status, updatedAt: Date.now() },
      { new: true, runValidators: true }
    )
      .populate('user', 'name email')
      .populate('business', 'name email phone address');

    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    res.json({ success: true, data: { message } });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/admin/messages/:id - Delete a message
exports.deleteMessage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const message = await Message.findByIdAndDelete(id);

    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    res.json({ success: true, message: 'Message deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/admin/users/:userId - Delete a user and their data
exports.deleteUser = async (req, res, next) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    await Message.deleteMany({ user: userId });
    await Search.deleteMany({ user: userId });
    await User.findByIdAndDelete(userId);

    res.json({ success: true, message: 'User and all related data deleted' });
  } catch (error) {
    next(error);
  }
};

// GET /api/admin/searches - All searches
exports.getAllSearches = async (req, res, next) => {
  try {
    const searches = await Search.find()
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    res.json({ success: true, data: { searches } });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/admin/searches/:id - Delete a search
exports.deleteSearch = async (req, res, next) => {
  try {
    const { id } = req.params;
    const search = await Search.findByIdAndDelete(id);

    if (!search) {
      return res.status(404).json({ success: false, message: 'Search not found' });
    }

    res.json({ success: true, message: 'Search deleted successfully' });
  } catch (error) {
    next(error);
  }
};
