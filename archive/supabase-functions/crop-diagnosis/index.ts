import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const diseaseApiUrl = Deno.env.get('DISEASE_API_URL');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!diseaseApiUrl) {
      return new Response(
        JSON.stringify({
          status: 'unconfigured',
          message: 'Crop diagnosis vision model service is not connected yet. Please consult your local KVK extension officer.',
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const formData = await req.formData();
    const imageFile = formData.get('image');
    const cropName = formData.get('cropName') || 'Cotton';
    const userId = formData.get('userId');

    if (!imageFile) {
      return new Response(
        JSON.stringify({ error: 'Leaf photo is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Call Vision Diagnosis Model
    const modelFormData = new FormData();
    modelFormData.append('image', imageFile);
    modelFormData.append('crop', cropName);

    const res = await fetch(diseaseApiUrl, {
      method: 'POST',
      body: modelFormData,
    });

    if (!res.ok) {
      throw new Error(`Vision model returned HTTP ${res.status}`);
    }

    const diagnosisResult = await res.json();

    // Optionally save to Supabase if client credentials present
    if (supabaseUrl && supabaseKey && userId) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      await supabase.from('crop_diagnoses').insert({
        user_id: userId,
        crop_name: cropName,
        diagnosis_title: diagnosisResult.title || 'Observed Leaf Condition',
        severity: diagnosisResult.severity || 'medium',
        recommendation: diagnosisResult.recommendation || 'Scout field regularly.',
        model_name: diagnosisResult.model || 'Vision-Agri-v1',
        confidence: diagnosisResult.confidence,
      });
    }

    return new Response(
      JSON.stringify({
        status: 'success',
        diagnosis: diagnosisResult,
        created_at: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ status: 'error', message: error.message || 'Crop diagnosis failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
