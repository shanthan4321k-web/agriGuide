import type { Language } from '../types';

/**
 * Web Speech API text-to-speech utility with multilingual support (English, Telugu, Hindi)
 */
export class SpeechService {
  private static synth: SpeechSynthesis | null = typeof window !== 'undefined' ? window.speechSynthesis : null;
  private static currentUtterance: SpeechSynthesisUtterance | null = null;

  /**
   * Speak the given text in the requested language
   */
  static speak(text: string, language: Language, onEnd?: () => void): void {
    if (!this.synth || !text) return;

    this.stop();

    // Clean markdown characters and fences before speaking
    const cleanedText = text
      .replace(/[*_#`~[\]()]/g, ' ')
      .replace(/₹\s*(\d+)/g, 'Rs $1')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanedText) return;

    const utterance = new SpeechSynthesisUtterance(cleanedText);
    this.currentUtterance = utterance;

    // Set locale
    if (language === 'te') {
      utterance.lang = 'te-IN';
      utterance.rate = 0.9;
    } else if (language === 'hi') {
      utterance.lang = 'hi-IN';
      utterance.rate = 0.95;
    } else {
      utterance.lang = 'en-IN';
      utterance.rate = 1.0;
    }

    // Try to find native voice
    const voices = this.synth.getVoices();
    const targetLangCode = language === 'te' ? 'te' : language === 'hi' ? 'hi' : 'en';
    const matchingVoice = voices.find(v => v.lang.startsWith(targetLangCode));
    if (matchingVoice) {
      utterance.voice = matchingVoice;
    }

    utterance.onend = () => {
      this.currentUtterance = null;
      if (onEnd) onEnd();
    };

    utterance.onerror = (e) => {
      console.warn('[SpeechService] Speech synthesis error/canceled:', e);
      this.currentUtterance = null;
      if (onEnd) onEnd();
    };

    this.synth.speak(utterance);
  }

  /**
   * Stop currently playing speech
   */
  static stop(): void {
    if (this.synth) {
      this.synth.cancel();
      this.currentUtterance = null;
    }
  }

  /**
   * Check if speech is currently playing
   */
  static isSpeaking(): boolean {
    return !!this.synth && (this.synth.speaking || this.synth.pending);
  }

  /**
   * Get active utterance
   */
  static getCurrentUtterance(): SpeechSynthesisUtterance | null {
    return this.currentUtterance;
  }
}
