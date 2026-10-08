import { supabase, isSupabaseConfigured } from '../../config/supabase.js';

// In-memory cache for live weather responses with 15-minute TTL
const weatherCache = new Map();
const CACHE_TTL_MS = 15 * 60 * 1000;

export async function getCurrentWeather({ latitude, longitude, district = 'Warangal', state = 'Telangana' }) {
  const cacheKey = `${latitude.toFixed(4)}_${longitude.toFixed(4)}`;
  const cached = weatherCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return {
      ...cached.data,
      isCached: true,
      source: `${cached.data.source} (Cache)`,
    };
  }

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&hourly=precipitation_probability,rain&timezone=Asia%2FKolkata&forecast_days=1`;

  const response = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    throw new Error(`Open-Meteo API returned status ${response.status}`);
  }

  const raw = await response.json();
  const current = raw.current;
  const hourly = raw.hourly;

  if (!current) {
    throw new Error('Incomplete meteorological data received from provider.');
  }

  const currentHour = new Date().getHours();
  const next6HoursRainProb = hourly?.precipitation_probability
    ? hourly.precipitation_probability.slice(currentHour, currentHour + 6)
    : [0];
  const maxRainProb = Math.max(...next6HoursRainProb, 0);

  const temp = Math.round(current.temperature_2m);
  const feelsLike = Math.round(current.apparent_temperature);
  const humidity = Math.round(current.relative_humidity_2m);
  const windSpeed = Math.round(current.wind_speed_10m);
  const weatherCode = current.weather_code;

  let conditionText = 'Clear & Sunny';
  if (weatherCode >= 1 && weatherCode <= 3) conditionText = 'Partly Cloudy';
  else if (weatherCode >= 51 && weatherCode <= 67) conditionText = 'Rainy / Showers';
  else if (weatherCode >= 80 && weatherCode <= 82) conditionText = 'Scattered Showers';
  else if (weatherCode >= 95) conditionText = 'Thunderstorm Warning';

  let sprayCondition = 'safe';
  let sprayWindowText = 'Safe to spray until 2:00 PM';
  let advisoryText = 'Low humidity and moderate breeze. Good conditions for nutrient absorption.';

  if (maxRainProb > 40 || current.precipitation > 0) {
    sprayCondition = 'unsafe';
    sprayWindowText = 'Avoid spraying today';
    advisoryText = `Rain expected (${maxRainProb}% chance). Pesticides will wash off crops.`;
  } else if (windSpeed > 18) {
    sprayCondition = 'unsafe';
    sprayWindowText = 'High wind drift';
    advisoryText = `Wind speed ${windSpeed} km/h exceeds safe spraying limits (>18 km/h).`;
  } else if (windSpeed >= 12 || humidity > 80) {
    sprayCondition = 'caution';
    sprayWindowText = 'Spray with caution in morning';
    advisoryText = `Moderate breeze (${windSpeed} km/h). Spray close to crop canopy.`;
  } else if (temp > 36) {
    sprayCondition = 'caution';
    sprayWindowText = 'Spray only before 10 AM or after 4 PM';
    advisoryText = `High heat (${temp}°C) may cause foliar scorch during midday.`;
  }

  const weatherData = {
    location: `${district}, ${state}`,
    temperature: temp,
    feelsLike,
    rainfallProbability: maxRainProb,
    humidity,
    windSpeedKmH: windSpeed,
    conditionText,
    isRainExpectedToday: maxRainProb > 30,
    advisoryText,
    sprayCondition,
    sprayWindowText,
    updatedAt: new Date().toISOString(),
    source: 'Open-Meteo (Live)',
    isCached: false,
  };

  // Cache response in memory
  weatherCache.set(cacheKey, {
    timestamp: Date.now(),
    data: weatherData,
  });

  // Optionally persist snapshot to Supabase PostgreSQL database
  if (isSupabaseConfigured()) {
    try {
      await supabase.from('weather_snapshots').insert({
        district,
        state,
        temperature: temp,
        humidity,
        wind_speed_kmh: windSpeed,
        rainfall_prob: maxRainProb,
        condition_text: conditionText,
        spray_condition: sprayCondition,
        source: 'Open-Meteo',
      });
    } catch (dbErr) {
      console.warn('[WeatherService] Supabase snapshot persist warning:', dbErr.message);
    }
  }

  return weatherData;
}
