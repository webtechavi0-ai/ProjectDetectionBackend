jest.mock('../models/Search', () => ({
  create: jest.fn(),
}));
jest.mock('../models/Business', () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  findById: jest.fn(),
}));
jest.mock('../services/playStore.service', () => ({
  searchApps: jest.fn(),
  getAppDetails: jest.fn(),
}));

const Search = require('../models/Search');
const Business = require('../models/Business');
const playStoreService = require('../services/playStore.service');
const { searchBusinesses } = require('./search.controller');
const { schoolBusinessId } = require('../config/pinnedBusiness');

describe('searchBusinesses', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('pins the configured school first and includes it in search history', async () => {
    const school = {
      _id: schoolBusinessId,
      placeId: 'geo-outreach-test-webtechavi0',
      name: 'Email Test Business',
      category: 'school',
    };
    playStoreService.searchApps.mockResolvedValue([]);
    Business.findById.mockResolvedValue(school);
    Search.create.mockResolvedValue({ _id: 'search-id' });
    const req = {
      query: { location: 'Toronto' },
      user: { id: 'user-id' },
    };
    const res = { json: jest.fn() };
    const next = jest.fn();

    await searchBusinesses(req, res, next);

    const response = res.json.mock.calls[0][0];
    expect(response.data.businesses[0]).toMatchObject({
      id: schoolBusinessId,
      name: 'Email Test Business',
      category: 'school',
      isPinned: true,
    });
    expect(response.data.count).toBe(1);
    expect(Search.create).toHaveBeenCalledWith(
      expect.objectContaining({
        businesses: [schoolBusinessId],
        resultsCount: 1,
      })
    );
    expect(next).not.toHaveBeenCalled();
  });
});
