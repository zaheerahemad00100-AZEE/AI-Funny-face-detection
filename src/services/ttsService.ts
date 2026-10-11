/**
 * Real-time Text-to-Speech (TTS) Service using Web Speech API (window.speechSynthesis).
 * Provides strict session state gating, single asynchronous utterance control,
 * queue management, cancellation, duplicate prevention, and clean English speech output.
 */

interface SpeechQueueItem {
  id: string;
  originalText: string;
  cleanText: string;
  faceId?: string;
  force?: boolean;
}

class TtsService {
  private isSessionActive: boolean = false;
  private isMuted: boolean = false;
  private lastSpokenText: string = '';
  private currentSpokenText: string = '';
  private selectedVoice: SpeechSynthesisVoice | null = null;
  private rate: number = 1.05;
  private pitch: number = 1.0;
  private isSupported: boolean = false;

  // Queue state to prevent overlapping speech or duplicate worker execution
  private queue: SpeechQueueItem[] = [];
  private isSpeaking: boolean = false;

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
        const preferred =
          voices.find(
            (v) =>
              v.lang.startsWith('en') &&
              (v.name.includes('Natural') ||
                v.name.includes('Google') ||
                v.name.includes('Samantha') ||
                v.name.includes('Zira') ||
                v.name.includes('David'))
          ) ||
          voices.find((v) => v.lang.startsWith('en')) ||
          voices[0];
        this.selectedVoice = preferred || null;
      }
    } catch {}
  }

  public getSupported(): boolean {
    return this.isSupported;
  }

  public getSessionActive(): boolean {
    return this.isSessionActive;
  }

  /**
   * Updates session active state. When inactive, speech output is strictly prohibited.
   */
  public setSessionActive(active: boolean) {
    this.isSessionActive = active;
    if (!active) {
      this.clearAndStop();
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (muted && this.isSupported) {
      this.clearAndStop();
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
      .replace(
        /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1FA00}-\u{1FAFF}\u{FE00}-\u{FE0F}]/gu,
        ''
      )
      .replace(/[^\x20-\x7E]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Enqueues a displayed comment to speak aloud.
   * Requirement 1: Only speaks when isSessionActive === true.
   * Requirement 2: Speaks the exact displayed comment.
   * Requirement 3: Prevents duplicate queue entries and overlapping voices.
   */
  public speak(text: string, force: boolean = false, faceId?: string) {
    // 1. Session must be strictly active
    if (!this.isSessionActive) {
      return;
    }

    if (!this.isSupported || !text || !text.trim() || this.isMuted) {
      return;
    }

    const cleanText = this.stripEmojis(text);
    if (!cleanText) return;

    // Prevent re-speaking the exact comment unless forced
    if (!force) {
      if (cleanText === this.lastSpokenText || cleanText === this.currentSpokenText) {
        return;
      }
      // Check if already in queue
      if (this.queue.some((item) => item.cleanText === cleanText)) {
        return;
      }
    }

    // Add to speech queue
    const item: SpeechQueueItem = {
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      originalText: text,
      cleanText,
      faceId,
      force,
    };

    // If queue already has items from other faces or older comments, keep only current fresh ones (max 2)
    // to avoid speaking outdated comments when face comment changes
    if (this.queue.length >= 2) {
      this.queue.shift();
    }
    this.queue.push(item);

    this.processQueue();
  }

  /**
   * Asynchronous queue processor to ensure exactly one utterance plays at a time
   * with zero UI freeze.
   */
  private processQueue() {
    if (!this.isSessionActive || !this.isSupported || this.isMuted) {
      this.clearAndStop();
      return;
    }

    if (this.isSpeaking || this.queue.length === 0) {
      return;
    }

    const nextItem = this.queue.shift();
    if (!nextItem) return;

    try {
      this.isSpeaking = true;
      this.currentSpokenText = nextItem.cleanText;

      const utterance = new SpeechSynthesisUtterance(nextItem.cleanText);
      if (this.selectedVoice) {
        utterance.voice = this.selectedVoice;
      }
      utterance.rate = this.rate;
      utterance.pitch = this.pitch;
      utterance.volume = 1.0;

      const finishUtterance = () => {
        this.isSpeaking = false;
        this.lastSpokenText = nextItem.cleanText;
        this.currentSpokenText = '';
        if (this.isSessionActive && this.queue.length > 0) {
          // Process next asynchronously
          setTimeout(() => this.processQueue(), 200);
        }
      };

      utterance.onend = () => {
        finishUtterance();
      };

      utterance.onerror = (e) => {
        console.warn('Speech synthesis utterance finished with error:', e);
        finishUtterance();
      };

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Speech synthesis error:', e);
      this.isSpeaking = false;
      this.currentSpokenText = '';
    }
  }

  /**
   * Immediately stops any active utterance and clears queue and history (End Session).
   */
  public clearAndStop() {
    this.queue = [];
    this.isSpeaking = false;
    this.currentSpokenText = '';
    this.lastSpokenText = '';
    if (this.isSupported && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
  }

  /**
   * Prunes pending queue items for a face that disappeared.
   */
  public removeQueueForFace(faceId: string) {
    this.queue = this.queue.filter((item) => item.faceId !== faceId);
  }

  /**
   * Repeats the active comment on demand (hotkey 'V').
   */
  public repeat(currentText?: string) {
    if (!this.isSessionActive) return;
    const textToRepeat = currentText || this.lastSpokenText;
    if (textToRepeat) {
      this.speak(textToRepeat, true);
    }
  }
}

export const ttsService = new TtsService();
