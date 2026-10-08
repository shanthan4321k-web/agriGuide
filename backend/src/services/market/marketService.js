import { env } from '../../config/env.js';
import { supabase, isSupabaseConfigured } from '../../config/supabase.js';

// In-memory cache for market records with 30-minute TTL
const marketCache = new Map();
const MARKET_CACHE_TTL_MS = 30 * 60 * 1000;

export function getMarketRecommendation(price) {
  const inputsUsed = ['modal_price', 'price_spread'];
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

export async function getCurrentMarketPrices({ district = 'Warangal', state = 'Telangana', commodity }) {
  const cacheKey = `${district.toLowerCase()}_${commodity ? commodity.toLowerCase() : 'all'}`;
  const cached = marketCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < MARKET_CACHE_TTL_MS) {
    return {
      records: cached.data.map(item => ({
        ...item,
        isCached: true,
        source: `${item.source} (Cache)`,
      })),
    };
  }

  // If Agmarknet API key is not configured, return honest unavailable response without inventing fake numbers
  if (!env.AGMARKNET_API_KEY) {
    const error = new Error('Market rates temporarily unavailable');
    error.code = 'MARKET_UNAVAILABLE';
    error.statusCode = 503;
    throw error;
  }

  const queryUrl = `${env.AGMARKNET_API_URL}?api-key=${env.AGMARKNET_API_KEY}&format=json&filters[district]=${encodeURIComponent(district)}`;
  const response = await fetch(queryUrl, {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    const error = new Error(`Agmarknet provider returned HTTP ${response.status}`);
    error.code = 'MARKET_PROVIDER_ERROR';
    error.statusCode = 502;
    throw error;
  }

  const json = await response.json();
  const rawRecords = json.records || [];

  if (rawRecords.length === 0) {
    return {
      records: [],
      message: `No active APMC arrival records found for ${district}.`,
    };
  }

  const normalized = rawRecords.map((r) => {
    const modal = Number(r.modal_price || 0);
    const min = Number(r.min_price || (modal > 0 ? modal * 0.94 : 0));
    const max = Number(r.max_price || (modal > 0 ? modal * 1.06 : 0));
    const rec = getMarketRecommendation({
      commodity: r.commodity || 'Produce',
      modalPrice: modal,
      minPrice: min,
      maxPrice: max,
    });

    return {
      commodity: r.commodity || commodity || 'Commodity',
      variety: r.variety || 'Standard',
      marketName: r.market || `${district} APMC Yard`,
      district: r.district || district,
      state: r.state || state,
      modalPrice: modal,
      minPrice: min,
      maxPrice: max,
      unit: 'quintal',
      date: r.arrival_date || new Date().toISOString().split('T')[0],
      trendPercentage: 0,
      trendDirection: 'steady',
      actionRecommendation: rec.decision,
      actionReason: rec.reason,
      updatedAt: new Date().toISOString(),
      source: 'Agmarknet / e-NAM Official Portal',
      isCached: false,
    };
  });

  marketCache.set(cacheKey, {
    timestamp: Date.now(),
    data: normalized,
  });

  // Optionally persist to Supabase PostgreSQL table
  if (isSupabaseConfigured() && normalized.length > 0) {
    try {
      const inserts = normalized.map(p => ({
        commodity: p.commodity,
        variety: p.variety,
        market_name: p.marketName,
        district: p.district,
        state: p.state,
        min_price: p.minPrice,
        modal_price: p.modalPrice,
        max_price: p.maxPrice,
        trend_percentage: p.trendPercentage,
        trend_direction: p.trendDirection,
        action_recommendation: p.actionRecommendation,
        arrival_date: p.date,
        source: 'Agmarknet',
      }));
      await supabase.from('market_prices').insert(inserts);
    } catch (dbErr) {
      console.warn('[MarketService] Supabase market_prices persist warning:', dbErr.message);
    }
  }

  return { records: normalized };
}
