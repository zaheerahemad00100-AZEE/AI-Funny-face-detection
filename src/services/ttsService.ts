/**
 * Real-time Text-to-Speech (TTS) Service using Web Speech API (window.speechSynthesis).
 * Provides non-blocking speech, duplicate prevention, voice selection, and mute controls.
 */

class TtsService {
  private isMuted: boolean = false;
  private lastSpokenText: string = '';
  private selectedVoice: SpeechSynthesisVoice | null = null;
  private rate: number = 1.05;
  private pitch: number = 1.0;
  private isSupported: boolean = false;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.isSupported = true;
      this.initVoices();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = () => this.initVoices();
      }
    }
  }

  private initVoices() {
    if (!this.isSupported) return;
    try {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        // Find natural, expressive English voice
        const preferred = voices.find(
          (v) =>
            v.lang.startsWith('en') &&
            (v.name.includes('Natural') ||
              v.name.includes('Google') ||
              v.name.includes('Samantha') ||
              v.name.includes('Zira') ||
              v.name.includes('David'))
        ) || voices.find((v) => v.lang.startsWith('en')) || voices[0];
        this.selectedVoice = preferred || null;
      }
    } catch {}
  }

  public getSupported(): boolean {
    return this.isSupported;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (muted && this.isSupported) {
      window.speechSynthesis.cancel();
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  /**
   * Cleans text for speech: strips emojis, symbols, and non-ASCII chars
   * so text-to-speech speaks the English words only and does not pronounce emoji names.
   */
  public stripEmojis(text: string): string {
    return text
      .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1FA00}-\u{1FAFF}\u{FE00}-\u{FE0F}]/gu, '')
      .replace(/[^\x20-\x7E]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Speaks the comment text. Ensures each unique comment is spoken only once.
   * Only speaks clean English words; does not pronounce emoji names.
   */
  public speak(text: string, force: boolean = false) {
    if (!this.isSupported || !text || !text.trim()) return;

    const cleanText = this.stripEmojis(text);
    if (!cleanText) return;

    if (!force && cleanText === this.lastSpokenText) return;

    if (this.isMuted && !force) {
      this.lastSpokenText = cleanText;
      return;
    }

    try {
      // Cancel previous utterance to avoid queue buildup and ensure zero lag
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(cleanText);
      if (this.selectedVoice) {
        utterance.voice = this.selectedVoice;
      }
      utterance.rate = this.rate;
      utterance.pitch = this.pitch;
      utterance.volume = 1.0;

      utterance.onend = () => {
        // Finished speaking
      };
      utterance.onerror = () => {
        // Handled silently
      };

      this.lastSpokenText = cleanText;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Speech synthesis error:', e);
    }
  }

  /**
   * Immediately stops any active utterance and clears history (for End Session).
   */
  public clearAndStop() {
    if (this.isSupported) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
    this.lastSpokenText = '';
  }

  /**
   * Repeats the active comment on demand (hotkey 'V').
   */
  public repeat(currentText?: string) {
    const textToRepeat = currentText || this.lastSpokenText;
    if (textToRepeat) {
      this.speak(textToRepeat, true);
    }
  }
}

export const ttsService = new TtsService();
