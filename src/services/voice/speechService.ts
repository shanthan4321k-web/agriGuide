import type { Language } from '../../types';
import { fetchApi } from '../apiConfig';

export const SpeechService = {
  isRecognitionSupported(): boolean {
    return typeof window !== 'undefined' && (
      'SpeechRecognition' in window || 'webkitSpeechRecognition' in window
    );
  },

  isSynthesisSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  },

  getLocaleCode(lang: Language): string {
    switch (lang) {
      case 'te': return 'te-IN';
      case 'hi': return 'hi-IN';
      case 'en': default: return 'en-IN';
    }
  },

  // 1. Backend Server-Side Transcription using Fireworks Whisper via Node.js Express Backend
  async transcribeAudioBlob(blob: Blob, lang: Language): Promise<{ text: string | null; error: string | null; provider?: string }> {
    try {
      const formData = new FormData();
      formData.append('file', blob, 'recording.webm');
      formData.append('language', lang);

      const res = await fetchApi<{
        status: string;
        text?: string;
        provider?: string;
        message?: string;
      }>('/voice/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (res.success && res.data && res.data.text) {
        return { text: res.data.text, error: null, provider: res.data.provider || 'fireworks-whisper' };
      }

      return { text: null, error: res.data?.message || 'Transcription unavailable' };
    } catch (e: any) {
      return { text: null, error: e.message || 'Voice transcription error' };
    }
  },

  // 2. Client-side Speech Recognition (Browser Web Speech API Fallback)
  startListening(
    lang: Language,
    onResult: (transcript: string) => void,
    onError: (error: string) => void,
    onEnd: () => void
  ): any {
    if (!this.isRecognitionSupported()) {
      onError('Voice recognition is not supported in this browser.');
      return null;
    }

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRec();

    recognition.lang = this.getLocaleCode(lang);
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      onResult(text);
    };

    recognition.onerror = (event: any) => {
      console.warn('[SpeechService] Web Speech recognition error:', event.error);
      onError(event.error === 'not-allowed' ? 'Microphone permission was denied.' : 'Could not understand the recording. Please try again.');
    };

    recognition.onend = () => {
      onEnd();
    };

    try {
      recognition.start();
      return recognition;
    } catch (e: any) {
      onError(e.message);
      return null;
    }
  },

  speakText(text: string, lang: Language): void {
    if (!this.isSynthesisSupported()) return;

    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = this.getLocaleCode(lang);
      utterance.rate = 0.95;

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('[SpeechService] Synthesis error:', e);
    }
  },

  stopSpeaking(): void {
    if (this.isSynthesisSupported()) {
      window.speechSynthesis.cancel();
    }
  }
};
