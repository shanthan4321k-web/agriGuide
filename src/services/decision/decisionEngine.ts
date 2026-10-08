import type { WeatherData, CropHealth, MarketPrice, TodayDecision } from '../../types';

export const DecisionEngine = {
  generateTodayDecision(
    weather: WeatherData | null,
    crops: CropHealth[],
    markets: MarketPrice[]
  ): TodayDecision {
    const cottonCrop = crops.find(c => c.cropName.toLowerCase().includes('cotton')) || crops[0];
    const isPestUnderWatch = cottonCrop?.status === 'under_watch' || cottonCrop?.status === 'attention';
    const cottonMarket = markets.find(m => m.commodity.toLowerCase().includes('cotton'));

    // 1. Critical Weather Warning Scenario (Heavy Rain Risk)
    if (weather && weather.isRainExpectedToday && weather.rainfallProbability > 50) {
      return {
        id: 'decision_rain_drainage',
        actionTitle: 'Check field drainage channels before expected rainfall',
        cropTarget: `${cottonCrop?.cropName || 'Field'} (${cottonCrop?.acres || 4.5} Acres)`,
        reason: `Live forecast indicates ${weather.rainfallProbability}% rainfall probability (${weather.conditionText}). Clear field trenches to prevent waterlogging.`,
        deadline: 'Before afternoon rain',
        urgency: 'high',
        category: 'irrigation',
        weatherContext: `${weather.temperature}°C · ${weather.rainfallProbability}% Rain Risk`,
        source: 'Weather-Informed Agronomic Rule',
        isCompleted: false,
      };
    }

    // 2. Optimal Spray Window when crop is under observation
    if (isPestUnderWatch && weather && weather.sprayCondition === 'safe') {
      return {
        id: 'decision_cotton_spray',
        actionTitle: `Inspect ${cottonCrop?.cropName || 'Cotton'} canopy and apply bio-pesticide if needed`,
        cropTarget: `${cottonCrop?.cropName || 'Cotton'} (${cottonCrop?.acres || 3.0} Acres)`,
        reason: `Plot is under watch. Current weather (${weather.temperature}°C, ${weather.windSpeedKmH} km/h wind) provides a safe window for foliar absorption.`,
        deadline: weather.sprayWindowText || 'Before 2:00 PM',
        urgency: 'high',
        category: 'pest',
        weatherContext: `${weather.temperature}°C · Safe Spray Window`,
        source: 'Integrated Pest Management (IPM) Rule',
        isCompleted: false,
      };
    }

    // 3. Spray Caution Scenario (Midday Heat or Wind)
    if (isPestUnderWatch && weather && weather.sprayCondition === 'caution') {
      return {
        id: 'decision_caution_spray',
        actionTitle: `Schedule foliar spraying for early morning or evening`,
        cropTarget: `${cottonCrop?.cropName || 'Cotton'} (${cottonCrop?.acres || 3.0} Acres)`,
        reason: `Current temperature (${weather.temperature}°C) or wind (${weather.windSpeedKmH} km/h) requires spraying during cooler hours to prevent foliar evaporation.`,
        deadline: 'Between 4:30 PM – 6:30 PM',
        urgency: 'medium',
        category: 'pest',
        weatherContext: `${weather.temperature}°C · Evening Window`,
        source: 'Agro-Met Advisory Rule',
        isCompleted: false,
      };
    }

    // 4. Mandi Price Opportunity Scenario (Real APMC rate)
    if (cottonMarket && cottonMarket.actionRecommendation === 'SELL' && cottonMarket.modalPrice > 0) {
      return {
        id: 'decision_mandi_sell',
        actionTitle: `Consider bringing ready produce to ${cottonMarket.marketName}`,
        cropTarget: `${cottonMarket.commodity} (Ready Harvest)`,
        reason: `Live APMC modal rate is ₹${cottonMarket.modalPrice.toLocaleString('en-IN')}/q with active trading conditions.`,
        deadline: 'Mandi trading hours: 9:00 AM – 3:00 PM',
        urgency: 'medium',
        category: 'market',
        weatherContext: weather ? `${weather.temperature}°C · Clear Transport` : 'Market Open',
        source: 'APMC Market Rule Engine',
        isCompleted: false,
      };
    }

    // 5. Baseline Routine Field Maintenance (Honest default, zero fake sensor facts)
    return {
      id: 'decision_field_inspection',
      actionTitle: `Conduct routine scouting in ${cottonCrop?.cropName || 'Cotton'} and Maize plots`,
      cropTarget: `${crops.map(c => c.cropName).join(' & ') || 'Farm Plots'} (${crops.reduce((acc, c) => acc + (c.acres || 0), 0) || 4.5} Acres)`,
      reason: 'Regular field scouting ensures early detection of pest emergence and nutrient deficiencies.',
      deadline: 'During morning hours',
      urgency: 'low',
      category: 'pest',
      weatherContext: weather ? `${weather.temperature}°C · ${weather.conditionText}` : 'Field Routine',
      source: 'Standard Crop Agronomy Guidelines',
      isCompleted: false,
    };
  }
};
