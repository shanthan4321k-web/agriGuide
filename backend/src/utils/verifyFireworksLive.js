import { env } from '../config/env.js';
import { generateTodayDecision } from '../services/decision/decisionEngine.js';
import { generateAdvisory } from '../services/ai/fireworksService.js';

async function runLiveVerification() {
  const isKeyLoaded = Boolean(env.FIREWORKS_API_KEY && env.FIREWORKS_API_KEY.trim().length > 0);
  
  console.log('=== FIREWORKS LIVE API VERIFICATION ===');
  console.log(`Base URL: ${env.FIREWORKS_BASE_URL}`);
  console.log(`Model: ${env.FIREWORKS_MODEL}`);
  console.log(`API Key Loaded: ${isKeyLoaded ? 'YES' : 'NO'}`);

  const testInput = {
    farmerProfile: {
      name: 'Ramesh Kumar',
      acres: 4.5,
      crops: ['Cotton', 'Maize'],
      district: 'Warangal',
      state: 'Telangana',
    },
    weatherData: {
      temperature: 27,
      rainfallProbability: 0,
      humidity: 74,
      windSpeedKmH: 8,
      conditionText: 'Clear & Sunny',
      sprayCondition: 'safe',
      sprayWindowText: 'Safe to spray until 2:00 PM',
    },
    cropObservations: [
      {
        cropName: 'Cotton',
        acres: 3.0,
        status: 'under_watch',
        notes: 'Routine scouting of lower leaf canopy',
      },
    ],
    marketPrice: {
      commodity: 'Cotton',
      modalPrice: 7100,
      trendPercentage: 1.2,
    },
    language: 'en',
  };

  // 1. Measure DecisionEngine Latency
  const t0_de = performance.now();
  const ruleDecision = generateTodayDecision({
    weather: testInput.weatherData,
    crops: testInput.cropObservations,
    markets: [testInput.marketPrice],
  });
  const t1_de = performance.now();
  const decisionEngineLatencyMs = (t1_de - t0_de).toFixed(2);

  let requestSent = false;
  let httpStatus = 'N/A';
  let fireworksResponseReceived = false;
  let apiLatencyMs = 'N/A';
  let jsonValidation = 'N/A';
  let fallbackUsed = false;
  let totalLatencyMs = 'N/A';
  let rawResponseData = null;
  let errorMessage = null;

  if (isKeyLoaded) {
    requestSent = true;
    const systemPrompt = `You are AgriGuide AI, a specialized agricultural decision-support reasoning engine for Indian farmers.
CRITICAL RULES:
1. NEVER invent or hallucinate factual weather, prices, disease names, crop measurements, or soil data.
2. Rely ONLY on the verified facts provided in the prompt context.
3. Formulate a practical, safe, high-priority recommendation for today.
4. Output in clear, simple English for an Indian farmer.
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
Farmer: Ramesh Kumar, 4.5 Acres in Warangal, Telangana
Crops: Cotton (3 Acres) & Maize (1.5 Acres)
Weather: 27°C, 0% rain prob, 8 km/h wind, spray: safe
Crop Observations: [{"cropName":"Cotton","status":"under_watch","notes":"Routine scouting"}]
Market Price: Cotton: ₹7100/q

Generate the today priority decision.`;

    const completionsUrl = `${env.FIREWORKS_BASE_URL}/chat/completions`;
    const t0_api = performance.now();

    try {
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
          max_tokens: 500,
        }),
        signal: AbortSignal.timeout(15000),
      });

      const t1_api = performance.now();
      apiLatencyMs = (t1_api - t0_api).toFixed(2);
      httpStatus = response.status.toString();

      if (response.ok) {
        fireworksResponseReceived = true;
        const aiJson = await response.json();
        const content = aiJson.choices?.[0]?.message?.content;

        // 2. Measure JSON Schema Validation Latency
        const t0_val = performance.now();
        const structured = JSON.parse(content);
        const hasRequiredKeys = 
          typeof structured.actionTitle === 'string' &&
          typeof structured.reason === 'string' &&
          typeof structured.cropTarget === 'string' &&
          ['high', 'medium', 'low'].includes(structured.urgency?.toLowerCase()) &&
          ['pest', 'irrigation', 'fertilizer', 'harvest', 'market'].includes(structured.category?.toLowerCase());

        const t1_val = performance.now();
        const valLatencyMs = (t1_val - t0_val).toFixed(2);

        if (hasRequiredKeys) {
          jsonValidation = `PASS (${valLatencyMs} ms)`;
          rawResponseData = structured;
        } else {
          jsonValidation = `FAIL: schema mismatch`;
          fallbackUsed = true;
        }
      } else {
        const errText = await response.text();
        errorMessage = `HTTP ${response.status}: ${errText.slice(0, 120)}`;
        fallbackUsed = true;
      }
    } catch (err) {
      errorMessage = err.message;
      fallbackUsed = true;
    }
  } else {
    fallbackUsed = true;
    errorMessage = 'FIREWORKS_API_KEY is not configured in backend/.env';
  }

  // 3. Test the full /api/advisor service call
  const t0_full = performance.now();
  const serviceResult = await generateAdvisory(testInput);
  const t1_full = performance.now();
  totalLatencyMs = (t1_full - t0_full).toFixed(2);

  console.log('\n--- TEST RESULTS SUMMARY ---');
  console.log(`Request Sent: ${requestSent ? 'YES' : 'NO'}`);
  console.log(`HTTP Status: ${httpStatus}`);
  console.log(`Fireworks Response Received: ${fireworksResponseReceived ? 'YES' : 'NO'}`);
  console.log(`Actual Fireworks API Latency: ${apiLatencyMs !== 'N/A' ? `${apiLatencyMs} ms` : 'N/A'}`);
  console.log(`Local DecisionEngine Latency: ${decisionEngineLatencyMs} ms`);
  console.log(`JSON Validation: ${jsonValidation}`);
  console.log(`Fallback Used: ${fallbackUsed ? 'YES' : 'NO'}`);
  console.log(`Total /api/advisor Latency: ${totalLatencyMs} ms`);
  
  if (rawResponseData) {
    console.log('\nStructured Response Received:');
    console.log(JSON.stringify(rawResponseData, null, 2));
  }
  if (errorMessage) {
    console.log(`\nInternal Note: ${errorMessage}`);
  }
}

runLiveVerification().catch(err => {
  console.error('Fatal test error:', err.message);
  process.exit(1);
});
