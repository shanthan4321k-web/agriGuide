import type { TodayDecision, WeatherData, CropHealth, MarketPrice, FarmerProfile, Language } from '../../types';
import { fetchApi } from '../apiConfig';

export interface StructuredAdvisoryOutput {
  actionTitle: string;
  cropTarget: string;
  reason: string;
  deadline: string;
  urgency: 'high' | 'medium' | 'low';
  category: 'pest' | 'irrigation' | 'fertilizer' | 'harvest' | 'market';
  weatherContext: string;
}

export const FireworksService = {
  async generateAdvisory(
    farmer: FarmerProfile,
    weather: WeatherData | null,
    crops: CropHealth[],
    markets: MarketPrice[],
    language: Language
  ): Promise<{
    decision: TodayDecision | null;
    status: 'success' | 'unconfigured' | 'error';
    source: string;
  }> {
    const payload = {
      farmerProfile: farmer,
      weatherData: weather ? {
        temperature: weather.temperature,
        rainfallProbability: weather.rainfallProbability,
        humidity: weather.humidity,
        windSpeedKmH: weather.windSpeedKmH,
        conditionText: weather.conditionText,
        sprayCondition: weather.sprayCondition,
      } : undefined,
      cropObservations: crops.map(c => ({
        cropName: c.cropName,
        status: c.status,
        notes: c.recommendedAction,
      })),
      marketPrice: markets.length > 0 ? {
        commodity: markets[0].commodity,
        modalPrice: markets[0].modalPrice,
        trendPercentage: markets[0].trendPercentage,
      } : undefined,
      language,
    };

    try {
      const response = await fetchApi<{
        status: string;
        decision?: StructuredAdvisoryOutput;
        model?: string;
        source?: string;
      }>('/advisor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.success || !response.data || !response.data.decision) {
        return {
          decision: null,
          status: response.data?.status === 'unconfigured' ? 'unconfigured' : 'error',
          source: 'AgriGuide AI Advisor (Offline)',
        };
      }

      const raw = response.data.decision;
      const todayDecision: TodayDecision = {
        id: `ai_decision_${Date.now()}`,
        actionTitle: raw.actionTitle || 'Inspect crops for daily routine check',
        cropTarget: raw.cropTarget || (crops[0]?.cropName ? `${crops[0].cropName} Plot` : 'Farm Plot'),
        reason: raw.reason || 'Synthesized from current weather conditions and crop observations.',
        deadline: raw.deadline || 'Before evening',
        urgency: raw.urgency || 'medium',
        category: raw.category || 'pest',
        weatherContext: raw.weatherContext || (weather ? `${weather.temperature}°C · ${weather.conditionText}` : 'Field Monitored'),
        source: response.data.source || `AgriGuide AI (${response.data.model || 'Fireworks AI'})`,
        isCompleted: false,
      };

      return {
        decision: todayDecision,
        status: response.data.status === 'unconfigured' ? 'unconfigured' : 'success',
        source: response.data.source || `Fireworks AI (${response.data.model || 'LLM'})`,
      };
    } catch (e: any) {
      console.warn('[FireworksService] Node backend advisory call notice:', e.message);
      return {
        decision: null,
        status: 'error',
        source: 'Fireworks AI (Offline)',
      };
    }
  }
};
