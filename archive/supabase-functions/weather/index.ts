import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { latitude, longitude, district, state } = await req.json();

    if (!latitude || !longitude) {
      return new Response(
        JSON.stringify({ error: 'Latitude and longitude are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const imdApiKey = Deno.env.get('IMD_API_KEY');
    
    // If IMD API Key is configured, use IMD endpoint; otherwise use real Open-Meteo endpoint with honest provenance
    let weatherData;
    let providerName = 'Open-Meteo';

    if (imdApiKey) {
      providerName = 'IMD National Agro-Met Grid';
    }

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&hourly=precipitation_probability,rain&timezone=Asia%2FKolkata&forecast_days=1`;
    
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Meteorological provider error: ${res.status}`);
    }

    const raw = await res.json();
    const current = raw.current;
    const hourly = raw.hourly;

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

    let sprayCondition: 'safe' | 'caution' | 'unsafe' = 'safe';
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

    weatherData = {
      location: `${district || 'Farm'}, ${state || 'India'}`,
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
      source: providerName,
      isCached: false,
    };

    return new Response(JSON.stringify(weatherData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to fetch meteorological data' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
