const Search = require('../models/Search');
const Business = require('../models/Business');
const googlePlacesService = require('../services/googlePlaces.service');

exports.searchBusinesses = async (req, res, next) => {
  try {
    const { location, radius, category, keyword } = req.query;

    const geocoded = await googlePlacesService.geocodeAddress(location);

    const places = await googlePlacesService.searchNearbyPlaces(
      geocoded.lat,
      geocoded.lng,
      parseFloat(radius),
      category,
      keyword
    );

    const businesses = await Promise.all(
      places.map(async (place) => {
        let business = await Business.findOne({ placeId: place.placeId });
        
        if (!business) {
          // Fetch detailed information for new businesses
          try {
            const detailedPlace = await googlePlacesService.getPlaceDetails(place.placeId);
            business = await Business.create({
              ...detailedPlace,
              metadata: {
                lastUpdated: new Date(),
                source: 'google_places',
              },
            });
          } catch (error) {
            // If detailed fetch fails, use basic place data
            console.error(`Failed to fetch details for ${place.placeId}:`, error.message);
            business = await Business.create({
              ...place,
              metadata: {
                lastUpdated: new Date(),
                source: 'google_places',
              },
            });
          }
        } else {
          // Update existing business with fresh data if older than 7 days
          const daysSinceUpdate = (Date.now() - business.metadata.lastUpdated) / (1000 * 60 * 60 * 24);
          if (daysSinceUpdate > 7) {
            try {
              const detailedPlace = await googlePlacesService.getPlaceDetails(place.placeId);
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

    const search = await Search.create({
      user: req.user.id,
      location: {
        type: 'Point',
        coordinates: [geocoded.lng, geocoded.lat],
        address: geocoded.formattedAddress,
      },
      radius: parseFloat(radius),
      filters: {
        category: category ? [category] : [],
      },
      resultsCount: businesses.length,
    });

    res.json({
      success: true,
      data: {
        searchId: search._id,
        location: {
          address: geocoded.formattedAddress,
          coordinates: {
            lat: geocoded.lat,
            lng: geocoded.lng,
          },
        },
        count: businesses.length,
        businesses: businesses.map((b) => ({
          id: b._id,
          placeId: b.placeId,
          name: b.name,
          address: b.address.formatted,
          category: b.category,
          types: b.types,
          location: {
            lat: b.location.coordinates[1],
            lng: b.location.coordinates[0],
          },
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
        const updatedDetails = await googlePlacesService.getPlaceDetails(business.placeId);
        
        business = await Business.findByIdAndUpdate(
          id,
          {
            ...updatedDetails,
            metadata: {
              lastUpdated: new Date(),
              source: 'google_places',
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
