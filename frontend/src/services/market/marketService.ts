import type { MarketPrice, LocationContext } from '../../types';
import { CacheService } from '../cacheService';
import { fetchApi } from '../apiConfig';

const MARKET_CACHE_KEY_PREFIX = 'mandi_prices_';

export interface MarketRecommendationResult {
  decision: 'SELL' | 'HOLD' | 'WAIT';
  reason: string;
  inputsUsed: string[];
}

export function getMarketRecommendation(price: {
  commodity: string;
  modalPrice: number;
  minPrice: number;
  maxPrice: number;
  trendPercentage?: number;
}): MarketRecommendationResult {
  const inputsUsed: string[] = ['modal_price', 'price_spread'];
  const spread = price.maxPrice - price.minPrice;
  const spreadRatio = price.modalPrice > 0 ? spread / price.modalPrice : 0;

  if (price.trendPercentage !== undefined && price.trendPercentage !== 0) {
    inputsUsed.push('trend_percentage');
    if (price.trendPercentage > 2.0) {
      return {
        decision: 'SELL',
        reason: `Strong upward momentum (+${price.trendPercentage}%). APMC auction bidding is active.`,
        inputsUsed,
      };
    } else if (price.trendPercentage < -2.0) {
      return {
        decision: 'HOLD',
        reason: `Recent arrival surge caused spot dips (${price.trendPercentage}%). Consider holding if storage permits.`,
        inputsUsed,
      };
    }
  }

  if (spreadRatio > 0.15) {
    inputsUsed.push('grade_spread_premium');
    return {
      decision: 'SELL',
      reason: 'Wide grade spread indicates premium bidding for well-dried produce.',
      inputsUsed,
    };
  }

  return {
    decision: 'WAIT',
    reason: 'Spot rates are steady. Monitor upcoming mandi arrival volumes.',
    inputsUsed,
  };
}

export const MarketService = {
  async fetchLiveMandiPrices(location: LocationContext): Promise<MarketPrice[]> {
    const cacheKey = `${MARKET_CACHE_KEY_PREFIX}${location.district.toLowerCase()}`;

    // 1. Call Node.js Express Backend (/api/market/current)
    try {
      const params = new URLSearchParams({
        district: location.district,
        state: location.state,
      });

      const res = await fetchApi<MarketPrice[]>(`/market/current?${params.toString()}`);

      if (res.success && res.data && res.data.length > 0) {
        CacheService.set(cacheKey, res.data);
        return res.data;
      }
    } catch (backendErr: any) {
      console.warn('[MarketService] Node backend market fetch notice:', backendErr.message);
    }

    // 2. Offline Cache fallback
    const cached = CacheService.get<MarketPrice[]>(cacheKey);
    if (cached && cached.data.length > 0) {
      return cached.data.map(item => ({
        ...item,
        isCached: true,
        source: `${item.source} (Offline Cache)`,
      }));
    }

    // 3. Honest Unconfigured/Unavailable handling (Zero fabricated prices)
    throw new Error(`Market rates for ${location.district} are currently unavailable.`);
  }
};
