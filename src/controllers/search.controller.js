const Search = require('../models/Search');
const Business = require('../models/Business');
const playStoreService = require('../services/playStore.service');

exports.searchBusinesses = async (req, res, next) => {
  try {
    const { location, category, keyword, country } = req.query;
    const { lat, lng } = req.query;

    const hasLatitude = lat !== undefined && lat !== '';
    const hasLongitude = lng !== undefined && lng !== '';
    if (hasLatitude !== hasLongitude) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude must be provided together.',
      });
    }

    let coordinates;
    if (hasLatitude && hasLongitude) {
      if (typeof lat !== 'string' || typeof lng !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Latitude and longitude must be single numeric values.',
        });
      }

      const latitude = Number(lat);
      const longitude = Number(lng);
      if (
        !location ||
        !Number.isFinite(latitude) ||
        latitude < -90 ||
        latitude > 90 ||
        !Number.isFinite(longitude) ||
        longitude < -180 ||
        longitude > 180
      ) {
        return res.status(400).json({
          success: false,
          message: 'A location and valid latitude/longitude coordinates are required.',
        });
      }

      coordinates = [longitude, latitude];
    }

    // Apps have no coordinates, so `location` is used as the search term when no keyword is given.
    const term = [keyword || location, category].filter(Boolean).join(' ');
    const locationAddress = coordinates ? location : term;

    const places = await playStoreService.searchApps(term, { country: country || undefined });

    const businesses = await Promise.all(
      places.map(async (place) => {
        let business = await Business.findOne({ placeId: place.placeId });
        
        if (!business) {
          // Fetch detailed information for new businesses
          try {
            const detailedPlace = await playStoreService.getAppDetails(place.placeId);
            business = await Business.create({
              ...detailedPlace,
              metadata: {
                lastUpdated: new Date(),
                source: 'google_play',
              },
            });
          } catch (error) {
            // If detailed fetch fails, use basic place data
            console.error(`Failed to fetch details for ${place.placeId}:`, error.message);
            business = await Business.create({
              ...place,
              metadata: {
                lastUpdated: new Date(),
                source: 'google_play',
              },
            });
          }
        } else {
          // Update existing business with fresh data if older than 7 days
          const daysSinceUpdate = (Date.now() - business.metadata.lastUpdated) / (1000 * 60 * 60 * 24);
          if (daysSinceUpdate > 7) {
            try {
              const detailedPlace = await playStoreService.getAppDetails(place.placeId);
              Object.assign(business, detailedPlace);
              business.metadata.lastUpdated = new Date();
              await business.save();
            } catch (error) {
              console.error(`Failed to update details for ${place.placeId}:`, error.message);
            }
          }
        }

        return business;
      })
    );

    const searchLocation = { address: locationAddress };
    if (coordinates) {
      searchLocation.type = 'Point';
      searchLocation.coordinates = coordinates;
    }

    const search = await Search.create({
      user: req.user.id,
      location: searchLocation,
      filters: {
        category: category ? [category] : [],
      },
      businesses: businesses.map((b) => b._id),
      resultsCount: businesses.length,
    });

    res.json({
      success: true,
      data: {
        searchId: search._id,
        location: {
          address: locationAddress,
          ...(coordinates
            ? { latitude: coordinates[1], longitude: coordinates[0] }
            : {}),
        },
        count: businesses.length,
        businesses: businesses.map((b) => ({
          id: b._id,
          placeId: b.placeId,
          name: b.name,
          address: b.address.formatted,
          category: b.category,
          types: b.types,
          developer: b.developer,
          summary: b.summary,
          installs: b.installs,
          icon: b.icon,
          url: b.url,
          email: b.email,
          phone: b.phone,
          website: b.website,
          rating: b.rating,
          totalRatings: b.totalRatings,
          priceLevel: b.priceLevel,
          openingHours: b.openingHours,
          businessStatus: b.businessStatus,
          photos: b.photos,
          reviews: b.reviews,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.getBusinessDetails = async (req, res, next) => {
  try {
    const { id } = req.params;

    let business = await Business.findById(id);

    if (!business) {
      return res.status(404).json({
        success: false,
        message: 'Business not found',
      });
    }

    const hoursSinceUpdate = (Date.now() - business.metadata.lastUpdated) / (1000 * 60 * 60);
    
    if (hoursSinceUpdate > 24) {
      try {
        const updatedDetails = await playStoreService.getAppDetails(business.placeId);
        
        business = await Business.findByIdAndUpdate(
          id,
          {
            ...updatedDetails,
            metadata: {
              lastUpdated: new Date(),
              source: 'google_play',
            },
          },
          { new: true }
        );
      } catch (error) {
        console.error('Failed to update business details:', error.message);
      }
    }

    res.json({
      success: true,
      data: { business },
    });
  } catch (error) {
    next(error);
  }
};

exports.getSearchHistory = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const searches = await Search.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const count = await Search.countDocuments({ user: req.user.id });

    res.json({
      success: true,
      data: {
        searches,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        total: count,
      },
    });
  } catch (error) {
    next(error);
  }
};
