const axios = require('axios');
const config = require('../config/env');

class GooglePlacesService {
  constructor() {
    this.apiKey = config.googleMapsApiKey;
    this.baseUrl = 'https://maps.googleapis.com/maps/api';
  }

  async geocodeAddress(address) {
    try {
      const response = await axios.get(`${this.baseUrl}/geocode/json`, {
        params: {
          address,
          key: this.apiKey,
        },
      });

      if (response.data.status !== 'OK' || !response.data.results.length) {
        throw new Error('Unable to geocode address');
      }

      const result = response.data.results[0];
      return {
        lat: result.geometry.location.lat,
        lng: result.geometry.location.lng,
        formattedAddress: result.formatted_address,
        addressComponents: result.address_components,
      };
    } catch (error) {
      throw new Error(`Geocoding failed: ${error.message}`);
    }
  }

  async searchNearbyPlaces(lat, lng, radius, type = null, keyword = null) {
    try {
      const params = {
        location: `${lat},${lng}`,
        radius: radius * 1000,
        key: this.apiKey,
      };

      if (type) params.type = type;
      if (keyword) params.keyword = keyword;

      const response = await axios.get(`${this.baseUrl}/place/nearbysearch/json`, {
        params,
      });

      if (response.data.status !== 'OK' && response.data.status !== 'ZERO_RESULTS') {
        throw new Error(`Places API error: ${response.data.status}`);
      }

      return response.data.results.map((place) => this.formatPlaceData(place));
    } catch (error) {
      throw new Error(`Nearby search failed: ${error.message}`);
    }
  }

  async getPlaceDetails(placeId) {
    try {
      const response = await axios.get(`${this.baseUrl}/place/details/json`, {
        params: {
          place_id: placeId,
          fields: 'name,formatted_address,address_components,geometry,types,formatted_phone_number,international_phone_number,website,url,rating,user_ratings_total,price_level,opening_hours,photos,business_status,utc_offset,vicinity,reviews',
          key: this.apiKey,
        },
      });

      if (response.data.status !== 'OK') {
        throw new Error(`Place details error: ${response.data.status}`);
      }

      return this.formatPlaceDetails(response.data.result);
    } catch (error) {
      throw new Error(`Get place details failed: ${error.message}`);
    }
  }

  formatPlaceData(place) {
    return {
      placeId: place.place_id,
      name: place.name,
      address: {
        formatted: place.vicinity || place.formatted_address,
      },
      location: {
        type: 'Point',
        coordinates: [place.geometry.location.lng, place.geometry.location.lat],
      },
      category: place.types?.[0] || 'business',
      types: place.types || [],
      phone: place.international_phone_number || place.formatted_phone_number,
      website: place.website,
      rating: place.rating,
      totalRatings: place.user_ratings_total,
      priceLevel: place.price_level,
      openingHours: place.opening_hours
        ? {
            isOpen: place.opening_hours.open_now,
            weekdayText: place.opening_hours.weekday_text || [],
          }
        : undefined,
      photos: place.photos?.slice(0, 5).map((photo) => ({
        reference: photo.photo_reference,
        width: photo.width,
        height: photo.height,
      })),
    };
  }

  formatPlaceDetails(place) {
    const addressComponents = {};
    place.address_components?.forEach((component) => {
      if (component.types.includes('street_number')) {
        addressComponents.street = component.long_name;
      } else if (component.types.includes('route')) {
        addressComponents.street = `${addressComponents.street || ''} ${component.long_name}`.trim();
      } else if (component.types.includes('locality')) {
        addressComponents.city = component.long_name;
      } else if (component.types.includes('administrative_area_level_1')) {
        addressComponents.state = component.long_name;
      } else if (component.types.includes('country')) {
        addressComponents.country = component.long_name;
      } else if (component.types.includes('postal_code')) {
        addressComponents.postalCode = component.long_name;
      }
    });

    return {
      placeId: place.place_id,
      name: place.name,
      address: {
        formatted: place.formatted_address,
        ...addressComponents,
      },
      location: {
        type: 'Point',
        coordinates: [place.geometry.location.lng, place.geometry.location.lat],
      },
      category: place.types?.[0] || 'business',
      types: place.types || [],
      phone: place.formatted_phone_number || place.international_phone_number,
      website: place.website,
      googleMapsUrl: place.url,
      businessStatus: place.business_status,
      rating: place.rating,
      totalRatings: place.user_ratings_total,
      priceLevel: place.price_level,
      openingHours: place.opening_hours
        ? {
            isOpen: place.opening_hours.open_now,
            weekdayText: place.opening_hours.weekday_text,
          }
        : undefined,
      photos: place.photos?.slice(0, 5).map((photo) => ({
        reference: photo.photo_reference,
        width: photo.width,
        height: photo.height,
      })),
      reviews: place.reviews?.slice(0, 5).map((review) => ({
        authorName: review.author_name,
        rating: review.rating,
        text: review.text,
        time: review.time,
        profilePhotoUrl: review.profile_photo_url,
      })),
    };
  }

  getPhotoUrl(photoReference, maxWidth = 400) {
    return `${this.baseUrl}/place/photo?maxwidth=${maxWidth}&photo_reference=${photoReference}&key=${this.apiKey}`;
  }
}

module.exports = new GooglePlacesService();
