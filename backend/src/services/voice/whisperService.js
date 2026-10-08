import { env } from '../../config/env.js';

export async function transcribeAudio({ fileBuffer, mimeType = 'audio/webm', language = 'en', filename = 'recording.webm' }) {
  if (!env.FIREWORKS_API_KEY) {
    const error = new Error('Voice transcription service is not configured on server.');
    error.code = 'VOICE_UNCONFIGURED';
    error.statusCode = 503;
    throw error;
  }

  const formData = new FormData();
  const blob = new Blob([fileBuffer], { type: mimeType });
  formData.append('file', blob, filename);
  formData.append('model', 'whisper-v3');

  if (language === 'te') formData.append('language', 'te');
  else if (language === 'hi') formData.append('language', 'hi');
  else formData.append('language', 'en');

  const transcriptionUrl = `${env.FIREWORKS_BASE_URL}/audio/transcriptions`;

  const response = await fetch(transcriptionUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.FIREWORKS_API_KEY}`,
    },
    body: formData,
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const errText = await response.text();
    const error = new Error(`Whisper transcription error (${response.status}): ${errText}`);
    error.code = 'TRANSCRIPTION_FAILED';
    error.statusCode = 502;
    throw error;
  }

  const result = await response.json();

  return {
    status: 'success',
    text: result.text || '',
    language,
    provider: 'fireworks-whisper',
    timestamp: new Date().toISOString(),
  };
}
