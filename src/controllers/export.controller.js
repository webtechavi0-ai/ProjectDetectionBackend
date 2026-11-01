const Business = require('../models/Business');
const Message = require('../models/Message');
const Search = require('../models/Search');

exports.exportLeads = async (req, res, next) => {
  try {
    const { searchId, format = 'csv' } = req.query;

    let businesses;
    if (searchId) {
      const search = await Search.findOne({ _id: searchId, user: req.user.id });
      if (!search) {
        return res.status(404).json({
          success: false,
          message: 'Search not found',
        });
      }

      businesses = await Business.find({ _id: { $in: search.businesses } });
    } else {
      const messages = await Message.find({ user: req.user.id }).populate('business');
      businesses = messages.map((m) => m.business).filter(Boolean);
    }

    if (format === 'csv') {
      const csv = generateCSV(businesses);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=leads.csv');
      res.send(csv);
    } else if (format === 'json') {
      res.json({
        success: true,
        data: { businesses },
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Unsupported format. Use csv or json',
      });
    }
  } catch (error) {
    next(error);
  }
};

function generateCSV(businesses) {
  const headers = [
    'Name',
    'Category',
    'Address',
    'City',
    'State',
    'Country',
    'Phone',
    'Email',
    'Website',
    'Rating',
    'Total Ratings',
    'Latitude',
    'Longitude',
  ];

  const rows = businesses.map((b) => [
    escapeCsvValue(b.name),
    escapeCsvValue(b.category),
    escapeCsvValue(b.address?.formatted || ''),
    escapeCsvValue(b.address?.city || ''),
    escapeCsvValue(b.address?.state || ''),
    escapeCsvValue(b.address?.country || ''),
    escapeCsvValue(b.phone || ''),
    escapeCsvValue(b.email || ''),
    escapeCsvValue(b.website || ''),
    b.rating || '',
    b.totalRatings || '',
    b.location?.coordinates?.[1] || '',
    b.location?.coordinates?.[0] || '',
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

function escapeCsvValue(value) {
  if (!value) return '';
  const stringValue = String(value);
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

exports.getStats = async (req, res, next) => {
  try {
    const [searchCount, messageCount, sentCount, businessCount] = await Promise.all([
      Search.countDocuments({ user: req.user.id }),
      Message.countDocuments({ user: req.user.id }),
      Message.countDocuments({ user: req.user.id, status: 'sent' }),
      Message.distinct('business', { user: req.user.id }).then((ids) => ids.length),
    ]);

    const recentSearches = await Search.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    const channelStats = await Message.aggregate([
      { $match: { user: req.user.id } },
      { $group: { _id: '$channel', count: { $sum: 1 } } },
    ]);

    res.json({
      success: true,
      data: {
        stats: {
          totalSearches: searchCount,
          totalMessages: messageCount,
          sentMessages: sentCount,
          uniqueBusinesses: businessCount,
        },
        recentSearches,
        channelStats,
      },
    });
  } catch (error) {
    next(error);
  }
};
