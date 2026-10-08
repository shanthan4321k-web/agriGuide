import type { WeatherData, LocationContext } from '../../types';
import { CacheService } from '../cacheService';
import { fetchApi } from '../apiConfig';

const WEATHER_CACHE_KEY_PREFIX = 'weather_data_';

export const WeatherService = {
  async fetchLiveWeather(location: LocationContext): Promise<WeatherData> {
    const cacheKey = `${WEATHER_CACHE_KEY_PREFIX}${location.district.toLowerCase()}`;

    // 1. Call Node.js Express Backend (/api/weather/current)
    try {
      const params = new URLSearchParams({
        latitude: location.latitude.toString(),
        longitude: location.longitude.toString(),
        district: location.district,
        state: location.state,
      });

      const response = await fetchApi<WeatherData>(`/weather/current?${params.toString()}`);

      if (response.success && response.data) {
        CacheService.set(cacheKey, response.data);
        return response.data;
      }
    } catch (backendErr) {
      console.warn('[WeatherService] Node backend weather fetch failed, checking offline cache:', backendErr);
    }

    // 2. Offline Cache Fallback (Honest provenance, never fabricated data)
    const cached = CacheService.get<WeatherData>(cacheKey);
    if (cached) {
      return {
        ...cached.data,
        isCached: true,
        source: `${cached.data.source} (Offline Cache)`,
      };
    }

    throw new Error('Weather information is temporarily unavailable.');
  }
};
