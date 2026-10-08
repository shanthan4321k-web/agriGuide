import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AdvisoryRequest {
  farmerProfile?: {
    name: string;
    acres: number;
    crops: string[];
    district: string;
    state: string;
  };
  weatherData?: {
    temperature: number;
    rainfallProbability: number;
    humidity: number;
    windSpeedKmH: number;
    conditionText: string;
    sprayCondition: string;
  };
  cropObservations?: Array<{
    cropName: string;
    status: string;
    notes?: string;
  }>;
  marketPrice?: {
    commodity: string;
    modalPrice: number;
    trendPercentage?: number;
  };
  language?: 'en' | 'te' | 'hi';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body: AdvisoryRequest = await req.json();
    const fireworksKey = Deno.env.get('FIREWORKS_API_KEY');
    const fireworksModel = Deno.env.get('FIREWORKS_MODEL') || 'accounts/fireworks/models/llama-v3p3-70b-instruct';

    if (!fireworksKey) {
      return new Response(
        JSON.stringify({
          status: 'unconfigured',
          message: 'Fireworks AI API key is not configured on server.',
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const languageInstruction = 
      body.language === 'te' ? 'Output the action and reason in authentic Telugu language (తెలుగు).' :
      body.language === 'hi' ? 'Output the action and reason in authentic Hindi language (हिन्दी).' :
      'Output in clear, simple English for an Indian farmer.';

    const systemPrompt = `You are AgriGuide AI, a specialized agricultural decision-support reasoning engine for Indian farmers.
CRITICAL RULES:
1. NEVER invent or hallucinate factual weather, prices, disease names, or soil data.
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
Farmer: ${body.farmerProfile?.name || 'Farmer'}, ${body.farmerProfile?.acres || 4.5} Acres in ${body.farmerProfile?.district || 'Telangana'}
Crops: ${body.farmerProfile?.crops?.join(', ') || 'Cotton & Maize'}
Weather: ${body.weatherData ? `${body.weatherData.temperature}°C, ${body.weatherData.rainfallProbability}% rain prob, ${body.weatherData.windSpeedKmH} km/h wind, spray: ${body.weatherData.sprayCondition}` : 'No weather feed'}
Crop Observations: ${JSON.stringify(body.cropObservations || [])}
Market Price: ${body.marketPrice ? `${body.marketPrice.commodity}: ₹${body.marketPrice.modalPrice}/q` : 'No market record'}

Generate the today priority decision.`;

    const fireworksRes = await fetch('https://api.fireworks.ai/inference/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${fireworksKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: fireworksModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
        max_tokens: 500,
      }),
    });

    if (!fireworksRes.ok) {
      const errText = await fireworksRes.text();
      throw new Error(`Fireworks API error (${fireworksRes.status}): ${errText}`);
    }

    const aiJson = await fireworksRes.json();
    const content = aiJson.choices?.[0]?.message?.content;
    const structuredDecision = JSON.parse(content);

    return new Response(
      JSON.stringify({
        status: 'success',
        decision: structuredDecision,
        model: fireworksModel,
        generatedAt: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ status: 'error', message: error.message || 'Advisory generation failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
