// google-play-scraper is ESM-only, so it is loaded with a dynamic import.
let gplayPromise;
const getGplay = () => {
  if (!gplayPromise) gplayPromise = import('google-play-scraper').then((m) => m.default);
  return gplayPromise;
};

class PlayStoreService {
  async searchApps(term, { country = 'us', lang = 'en', num = 20 } = {}) {
    try {
      const gplay = await getGplay();
      const apps = await gplay.search({ term, country, lang, num, fullDetail: true });
      return apps.map((app) => this.formatApp(app));
    } catch (error) {
      throw new Error(`Play Store search failed: ${error.message}`);
    }
  }

  async getAppDetails(appId, { country = 'us', lang = 'en' } = {}) {
    try {
      const gplay = await getGplay();
      const [app, reviews] = await Promise.all([
        gplay.app({ appId, country, lang }),
        gplay.reviews({ appId, country, lang, num: 5 }).catch(() => ({ data: [] })),
      ]);
      return {
        ...this.formatApp(app),
        reviews: reviews.data.map((r) => ({
          authorName: r.userName,
          rating: r.score,
          text: r.text,
          time: r.date ? new Date(r.date).getTime() : undefined,
          profilePhotoUrl: r.userImage,
        })),
      };
    } catch (error) {
      throw new Error(`Get app details failed: ${error.message}`);
    }
  }

  formatApp(app) {
    return {
      placeId: app.appId,
      name: app.title,
      address: { formatted: app.developerAddress || app.developer },
      category: app.genre || 'app',
      types: [app.genreId].filter(Boolean),
      email: app.developerEmail,
      website: app.developerWebsite,
      rating: app.score,
      totalRatings: app.ratings,
      priceLevel: app.free ? 0 : 1,
      photos: (app.screenshots || []).slice(0, 5).map((url) => ({ reference: url })),
      developer: app.developer,
      summary: app.summary,
      installs: app.installs,
      icon: app.icon,
      url: app.url,
    };
  }
}

module.exports = new PlayStoreService();
