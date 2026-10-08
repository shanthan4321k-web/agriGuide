import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MarketInput {
  commodity: string;
  modalPrice: number;
  minPrice: number;
  maxPrice: number;
  trendPercentage?: number;
  arrivalDate?: string;
}

function getMarketRecommendation(input: MarketInput): {
  decision: 'SELL' | 'HOLD' | 'WAIT';
  reason: string;
  inputsUsed: string[];
} {
  const inputsUsed: string[] = ['modal_price', 'price_spread'];
  const spread = input.maxPrice - input.minPrice;
  const spreadRatio = input.modalPrice > 0 ? spread / input.modalPrice : 0;

  if (input.trendPercentage !== undefined) {
    inputsUsed.push('trend_percentage');
    if (input.trendPercentage > 2.0) {
      return {
        decision: 'SELL',
        reason: `Strong upward momentum (+${input.trendPercentage}%). APMC clearing rates are favorable.`,
        inputsUsed,
      };
    } else if (input.trendPercentage < -2.0) {
      return {
        decision: 'HOLD',
        reason: `Recent arrival surge caused spot dips (${input.trendPercentage}%). Consider waiting for price stabilization.`,
        inputsUsed,
      };
    }
  }

  if (spreadRatio > 0.15) {
    inputsUsed.push('grade_spread_premium');
    return {
      decision: 'SELL',
      reason: 'Wide price spread indicates high bidding premium for well-dried, sorted produce.',
      inputsUsed,
    };
  }

  return {
    decision: 'WAIT',
    reason: 'Spot rates are steady. Monitor upcoming mandi arrival volumes before liquidating lots.',
    inputsUsed,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { district, state, commodity } = await req.json();

    const agmarknetApiKey = Deno.env.get('AGMARKNET_API_KEY');
    const agmarknetApiUrl = Deno.env.get('AGMARKNET_API_URL') || 'https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070';

    if (!agmarknetApiKey) {
      // If API key is not configured, return honest configuration notice
      return new Response(
        JSON.stringify({
          status: 'unconfigured',
          message: 'Agmarknet / e-NAM API key is not configured on server.',
          records: [],
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const queryUrl = `${agmarknetApiUrl}?api-key=${agmarknetApiKey}&format=json&filters[district]=${encodeURIComponent(district || 'Warangal')}`;
    const res = await fetch(queryUrl, { headers: { 'Accept': 'application/json' } });

    if (!res.ok) {
      throw new Error(`Agmarknet provider returned HTTP ${res.status}`);
    }

    const json = await res.json();
    const rawRecords = json.records || [];

    if (rawRecords.length === 0) {
      return new Response(
        JSON.stringify({
          status: 'empty',
          message: `No active APMC arrival records found for ${district}.`,
          records: [],
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const normalized = rawRecords.map((r: any) => {
      const modal = Number(r.modal_price || 0);
      const min = Number(r.min_price || modal * 0.94);
      const max = Number(r.max_price || modal * 1.06);
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
        trendDirection: 'steady' as const,
        actionRecommendation: rec.decision,
        actionReason: rec.reason,
        updatedAt: new Date().toISOString(),
        source: 'Agmarknet / e-NAM Official Portal',
        isCached: false,
      };
    });

    return new Response(JSON.stringify({ status: 'success', records: normalized }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ status: 'error', message: error.message || 'Market service failure' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
