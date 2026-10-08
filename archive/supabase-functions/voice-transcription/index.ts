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
    const fireworksKey = Deno.env.get('FIREWORKS_API_KEY');

    if (!fireworksKey) {
      return new Response(
        JSON.stringify({
          status: 'unconfigured',
          message: 'Voice transcription service is not configured on server.',
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const formData = await req.formData();
    const audioFile = formData.get('file');
    const language = formData.get('language') || 'en';

    if (!audioFile) {
      return new Response(
        JSON.stringify({ error: 'Audio file is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Call Fireworks Whisper Transcription API
    const whisperFormData = new FormData();
    whisperFormData.append('file', audioFile);
    whisperFormData.append('model', 'whisper-v3');
    if (language === 'te') whisperFormData.append('language', 'te');
    else if (language === 'hi') whisperFormData.append('language', 'hi');
    else whisperFormData.append('language', 'en');

    const res = await fetch('https://api.fireworks.ai/inference/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${fireworksKey}`,
      },
      body: whisperFormData,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Whisper transcription error (${res.status}): ${errText}`);
    }

    const result = await res.json();

    return new Response(
      JSON.stringify({
        status: 'success',
        text: result.text || '',
        language,
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ status: 'error', message: error.message || 'Transcription failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
