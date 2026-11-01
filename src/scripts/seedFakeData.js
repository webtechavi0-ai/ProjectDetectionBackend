const User = require('../models/User');
const Business = require('../models/Business');
const Search = require('../models/Search');
const Message = require('../models/Message');

const CITY = { name: 'Bengaluru', state: 'Karnataka', country: 'India', lng: 77.5946, lat: 12.9716 };
const CATEGORIES = ['restaurant', 'gym', 'salon', 'pharmacy', 'cafe', 'bakery'];
const NAMES = ['Sunrise', 'Blue Lotus', 'Urban', 'Green Leaf', 'Royal', 'Metro', 'Spice', 'Happy', 'Prime', 'Zen'];

const pick = (arr, i) => arr[i % arr.length];
const jitter = (base, i, scale) => base + (((i * 37) % 100) - 50) / 50 * scale;

async function seedFakeData() {
  const admin = await User.create({
    name: 'Avinash',
    email: 'avinash@admin.com',
    password: '123456',
    role: 'admin',
    company: 'GeoOutreach',
  });
  const user = await User.create({
    name: 'Test User',
    email: 'user@test.com',
    password: '123456',
    company: 'Test Co',
  });

  const businesses = await Business.insertMany(
    Array.from({ length: 30 }, (_, i) => {
      const category = pick(CATEGORIES, i);
      const name = `${pick(NAMES, i)} ${category[0].toUpperCase()}${category.slice(1)} ${i + 1}`;
      return {
        placeId: `fake_place_${i + 1}`,
        name,
        address: {
          formatted: `${i + 1} MG Road, ${CITY.name}, ${CITY.state}`,
          street: `${i + 1} MG Road`,
          city: CITY.name,
          state: CITY.state,
          country: CITY.country,
          postalCode: `5600${String(i % 100).padStart(2, '0')}`,
        },
        location: {
          type: 'Point',
          coordinates: [jitter(CITY.lng, i, 0.05), jitter(CITY.lat, i * 3, 0.05)],
        },
        category,
        types: [category, 'point_of_interest'],
        phone: `+91 98${String(10000000 + i * 7919).slice(0, 8)}`,
        email: `contact${i + 1}@fake-${category}.test`,
        website: `https://fake-${category}-${i + 1}.test`,
        rating: 3 + (i % 21) / 10,
        totalRatings: 20 + i * 13,
        priceLevel: i % 5,
        openingHours: { isOpen: i % 3 !== 0, weekdayText: ['Mon-Sun: 9:00 AM – 9:00 PM'] },
        metadata: { source: 'fake_seed' },
      };
    })
  );

  const search = await Search.create({
    user: user._id,
    location: { type: 'Point', coordinates: [CITY.lng, CITY.lat], address: `${CITY.name}, ${CITY.state}` },
    radius: 5,
    filters: { category: ['restaurant', 'cafe'], minRating: 3.5 },
    resultsCount: businesses.length,
  });

  await Message.insertMany(
    businesses.slice(0, 6).map((b, i) => ({
      user: user._id,
      business: b._id,
      search: search._id,
      channel: pick(['email', 'sms', 'whatsapp'], i),
      recipient: { email: b.email, phone: b.phone },
      subject: 'Partnership opportunity',
      content: `Hi ${b.name}, we'd love to work with you.`,
      aiGenerated: i % 2 === 0,
      status: pick(['draft', 'sent', 'delivered', 'opened'], i),
    }))
  );

  console.log(
    `🌱 Fake DB seeded: 2 users (${admin.email} / ${user.email}, password 123456), ` +
      `${businesses.length} businesses, 1 search, 6 messages`
  );
}

module.exports = seedFakeData;
