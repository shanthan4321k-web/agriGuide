import { env } from '../../config/env.js';
import { supabase, isSupabaseConfigured } from '../../config/supabase.js';
import { generateTodayDecision } from '../decision/decisionEngine.js';

export async function generateAdvisory({
  farmerProfile,
  weatherData,
  cropObservations = [],
  marketPrice,
  language = 'en',
  user = null,
}) {
  // If Fireworks API Key is not configured, fall back gracefully to the deterministic rule-based decision engine
  if (!env.FIREWORKS_API_KEY) {
    const fallbackDecision = generateTodayDecision({
      weather: weatherData || null,
      crops: cropObservations.map(c => ({
        cropName: c.cropName || 'Crop',
        acres: 3.0,
        status: c.status || 'healthy',
      })),
      markets: marketPrice ? [{
        commodity: marketPrice.commodity || 'Produce',
        modalPrice: marketPrice.modalPrice || 0,
        actionRecommendation: 'WAIT',
      }] : [],
    });

    return {
      status: 'unconfigured',
      decision: fallbackDecision,
      source: 'AgriGuide Rule-Based Agronomy Engine (Fireworks Unconfigured)',
      generatedAt: new Date().toISOString(),
    };
  }

  const languageInstruction =
    language === 'te' ? 'Output the action and reason in authentic Telugu language (తెలుగు).' :
    language === 'hi' ? 'Output the action and reason in authentic Hindi language (हिन्दी).' :
    'Output in clear, simple English for an Indian farmer.';

  const systemPrompt = `You are AgriGuide AI, a specialized agricultural decision-support reasoning engine for Indian farmers.
CRITICAL RULES:
1. NEVER invent or hallucinate factual weather, prices, disease names, crop measurements, or soil data.
2. Rely ONLY on the verified facts provided in the prompt context.
3. Formulate a practical, safe, high-priority recommendation for today.
4. ${languageInstruction}
5. Return ONLY a valid JSON object with the following schema:
{
  "actionTitle": string,
  "cropTarget": string,
  "reason": string,
  "deadline": string,
  "urgency": "high" | "medium" | "low",
  "category": "pest" | "irrigation" | "fertilizer" | "harvest" | "market",
  "weatherContext": string
}`;

  const userPrompt = `Given the following verified farm context:
Farmer: ${farmerProfile?.name || 'Farmer'}, ${farmerProfile?.acres || 4.5} Acres in ${farmerProfile?.district || 'Telangana'}
Crops: ${farmerProfile?.crops?.join(', ') || 'Cotton & Maize'}
Weather: ${weatherData ? `${weatherData.temperature}°C, ${weatherData.rainfallProbability}% rain prob, ${weatherData.windSpeedKmH} km/h wind, spray: ${weatherData.sprayCondition}` : 'No weather feed'}
Crop Observations: ${JSON.stringify(cropObservations)}
Market Price: ${marketPrice ? `${marketPrice.commodity}: ₹${marketPrice.modalPrice}/q` : 'No market record'}

Generate the today priority decision.`;

  const completionsUrl = `${env.FIREWORKS_BASE_URL}/chat/completions`;

  const response = await fetch(completionsUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.FIREWORKS_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: env.FIREWORKS_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
      max_tokens: 1500,
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Fireworks API error (${response.status}): ${errText}`);
  }

  const aiJson = await response.json();
  const content = aiJson.choices?.[0]?.message?.content;
  const structuredDecision = JSON.parse(content);

  // Validate the structured output schema
  if (!structuredDecision.actionTitle || !structuredDecision.reason) {
    throw new Error('Fireworks response failed schema validation: missing actionTitle or reason');
  }

  // Optionally persist recommendation to Supabase
  if (isSupabaseConfigured() && user?.id) {
    try {
      await supabase.from('recommendations').insert({
        user_id: user.id,
        action_title: structuredDecision.actionTitle,
        crop_target: structuredDecision.cropTarget || 'Farm Plot',
        reason: structuredDecision.reason,
        deadline: structuredDecision.deadline || 'Today',
        urgency: structuredDecision.urgency || 'medium',
        category: structuredDecision.category || 'pest',
        weather_context: structuredDecision.weatherContext || (weatherData ? `${weatherData.temperature}°C` : ''),
        source: `Fireworks AI (${env.FIREWORKS_MODEL})`,
        inputs_used: {
          weather: weatherData ? { temp: weatherData.temperature, rain: weatherData.rainfallProbability } : null,
          market: marketPrice ? { price: marketPrice.modalPrice } : null,
        },
      });
    } catch (dbErr) {
      console.warn('[FireworksService] Supabase recommendation persist warning:', dbErr.message);
    }
  }

  return {
    status: 'success',
    decision: structuredDecision,
    model: env.FIREWORKS_MODEL,
    generatedAt: new Date().toISOString(),
  };
}
