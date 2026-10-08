import type { LocationContext } from '../../types';
import { CacheService } from '../cacheService';

export const AGRICULTURAL_DISTRICTS: LocationContext[] = [
  {
    district: 'Warangal',
    state: 'Telangana',
    village: 'Geesugonda',
    latitude: 17.9689,
    longitude: 79.5941,
    source: 'default',
  },
  {
    district: 'Guntur',
    state: 'Andhra Pradesh',
    village: 'Tenali',
    latitude: 16.3067,
    longitude: 80.4365,
    source: 'manual',
  },
  {
    district: 'Kurnool',
    state: 'Andhra Pradesh',
    village: 'Nandyal',
    latitude: 15.8281,
    longitude: 78.0373,
    source: 'manual',
  },
  {
    district: 'Nashik',
    state: 'Maharashtra',
    village: 'Niphad',
    latitude: 19.9975,
    longitude: 73.7898,
    source: 'manual',
  },
  {
    district: 'Bathinda',
    state: 'Punjab',
    village: 'Maur',
    latitude: 30.2110,
    longitude: 74.9455,
    source: 'manual',
  },
  {
    district: 'Indore',
    state: 'Madhya Pradesh',
    village: 'Sanwer',
    latitude: 22.7196,
    longitude: 75.8577,
    source: 'manual',
  }
];

const LOCATION_CACHE_KEY = 'user_selected_location';

export const LocationService = {
  getDefaultLocation(): LocationContext {
    const cached = CacheService.get<LocationContext>(LOCATION_CACHE_KEY);
    if (cached) return cached.data;
    return AGRICULTURAL_DISTRICTS[0];
  },

  saveLocation(loc: LocationContext): void {
    CacheService.set(LOCATION_CACHE_KEY, loc);
  },

  async requestDeviceLocation(): Promise<LocationContext> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported by this browser'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          
          let closest = AGRICULTURAL_DISTRICTS[0];
          let minDistance = Infinity;

          for (const d of AGRICULTURAL_DISTRICTS) {
            const dist = Math.hypot(d.latitude - lat, d.longitude - lon);
            if (dist < minDistance) {
              minDistance = dist;
              closest = d;
            }
          }

          const resolvedLocation: LocationContext = {
            district: closest.district,
            state: closest.state,
            village: 'GPS Detected',
            latitude: lat,
            longitude: lon,
            source: 'gps',
          };

          LocationService.saveLocation(resolvedLocation);
          resolve(resolvedLocation);
        },
        (error) => {
          console.warn('[LocationService] GPS permission denied or failed:', error.message);
          reject(error);
        },
        { timeout: 8000, enableHighAccuracy: false }
      );
    });
  }
};
