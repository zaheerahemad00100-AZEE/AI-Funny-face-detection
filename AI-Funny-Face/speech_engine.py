"""
AI Funny Face Commentator - Text-to-Speech (TTS) Engine
Provides non-blocking, offline voice commentary using pyttsx3 with thread-safe queuing,
duplicate prevention, voice customization, and immediate speech cancellation on session end.
"""

import threading
import queue
import time
from typing import Optional


class SpeechEngine:
    """
    Offline Text-to-Speech engine running in a dedicated background worker thread.
    Features:
      - 100% offline (no cloud API or paid keys required)
      - Non-blocking speech queue (prevents webcam lag and animation stutter)
      - Single-announcement enforcement (prevents repeated frames from triggering speech)
      - Anti-lag queue purging (discards stale speech if comments change rapidly)
      - Immediate cancellation on End Session (aborts active speech and empties queue)
      - Mute / Unmute toggle and repeat functionality
      - Safe COM initialization on Windows inside the worker thread
    """

    def __init__(self, rate: int = 175, volume: float = 1.0, enabled: bool = True):
        self.rate = rate
        self.volume = volume
        self.is_muted = not enabled
        self.is_available = False

        self._queue = queue.Queue(maxsize=8)
        self._last_spoken_text: str = ""
        self._current_text: str = ""
        self._stop_event = threading.Event()
        self._engine = None
        self._worker_thread: Optional[threading.Thread] = None
        self._is_speaking = False

        # Start background worker
        self._worker_thread = threading.Thread(target=self._run_worker, name="TTS-Worker", daemon=True)
        self._worker_thread.start()

    def _run_worker(self) -> None:
        """
        Background worker loop. Initializes pyttsx3 inside the thread for COM safety.
        """
        try:
            import pyttsx3
            # Initialize inside thread (required for Windows SAPI5 / COM threading)
            self._engine = pyttsx3.init()
            self._engine.setProperty("rate", self.rate)
            self._engine.setProperty("volume", self.volume)

            # Pick the clearest, most natural available system voice
            try:
                voices = self._engine.getProperty("voices")
                if voices:
                    selected_voice = voices[0].id
                    # Prefer expressive natural voices (e.g. Zira, David, Samantha, Natural)
                    for v in voices:
                        name_lower = v.name.lower()
                        if any(k in name_lower for k in ["zira", "natural", "female", "david", "samantha", "george"]):
                            selected_voice = v.id
                            break
                    self._engine.setProperty("voice", selected_voice)
            except Exception:
                pass

            self.is_available = True
            print("[SpeechEngine] Offline TTS engine initialized successfully.")
        except Exception as e:
            print(f"[SpeechEngine] Warning: pyttsx3 failed to initialize: {e}")
            print("[SpeechEngine] Speech commentary disabled; visual tracking continues smoothly.")
            self.is_available = False

        # Main speech loop
        while not self._stop_event.is_set():
            try:
                # Wait for next text item with timeout to check stop_event
                item = self._queue.get(timeout=0.2)
                if item is None:  # Sentinel value to exit
                    break

                text, force = item

                # If muted and not forced repeat, skip
                if self.is_muted and not force:
                    self._queue.task_done()
                    continue

                if self.is_available and self._engine and not self._stop_event.is_set():
                    try:
                        self._is_speaking = True
                        self._current_text = text
                        # Speak text aloud
                        self._engine.say(text)
                        self._engine.runAndWait()
                        self._last_spoken_text = text
                    except Exception as err:
                        print(f"[SpeechEngine] Speech playback error: {err}")
                    finally:
                        self._is_speaking = False

                self._queue.task_done()

            except queue.Empty:
                continue
            except Exception as e:
                print(f"[SpeechEngine] Unexpected worker loop error: {e}")

        # Cleanup engine on exit
        if self._engine:
            try:
                self._engine.stop()
            except Exception:
                pass

    @staticmethod
    def strip_emojis_for_speech(text: str) -> str:
        """
        Strips emojis and non-ASCII symbols so text-to-speech speaks
        English words only without pronouncing emoji names.
        """
        import re
        cleaned = re.sub(r'[^\x00-\x7F]+', ' ', text)
        cleaned = ' '.join(cleaned.split()).strip()
        return cleaned if cleaned else text

    def speak(self, text: str, force: bool = False) -> None:
        """
        Queues text for speaking.
        Strips emojis so only clean English words are spoken aloud.
        Ignores duplicates unless force=True.
        """
        if not text or not text.strip():
            return

        # Strip emojis so TTS speaks English words only
        clean_text = self.strip_emojis_for_speech(text)
        if not clean_text:
            return

        # If already spoken and not forced, ignore
        if not force and clean_text == self._last_spoken_text:
            return

        if self.is_muted and not force:
            self._last_spoken_text = clean_text
            return

        # Purge stale backlog in queue so speech remains strictly synchronized
        while not self._queue.empty():
            try:
                self._queue.get_nowait()
                self._queue.task_done()
            except (queue.Empty, ValueError):
                break

        try:
            self._queue.put_nowait((clean_text, force))
            self._last_spoken_text = clean_text
        except queue.Full:
            pass

    def clear_and_stop(self) -> None:
        """
        Immediately purges any pending comments in the queue and stops active speech.
        Called when 'End Session' is clicked.
        """
        # Empty all items in queue
        while not self._queue.empty():
            try:
                self._queue.get_nowait()
                self._queue.task_done()
            except (queue.Empty, ValueError):
                break

        # Stop ongoing utterance promptly if engine is running
        if self._engine:
            try:
                self._engine.stop()
            except Exception:
                pass

        self._last_spoken_text = ""
        self._current_text = ""
        self._is_speaking = False
        print("[SpeechEngine] Pending speech cleared and voice halted.")

    def repeat_current(self, current_text: Optional[str] = None) -> None:
        """
        Repeats the active comment aloud on demand (press 'V').
        """
        target = current_text if current_text else self._last_spoken_text
        if target:
            print(f"[SpeechEngine] Repeating comment: '{target}'")
            self.speak(target, force=True)

    def toggle_mute(self) -> bool:
        """
        Toggles mute state on/off (press 'M').
        Returns the new muted state.
        """
        self.is_muted = not self.is_muted
        if self.is_muted:
            self.clear_and_stop()
        status = "MUTED" if self.is_muted else "UNMUTED (ACTIVE)"
        print(f"[SpeechEngine] Voice output: {status}")
        return self.is_muted

    def set_rate(self, rate: int) -> None:
        """Adjusts speech rate in words per minute."""
        self.rate = rate
        if self._engine:
            try:
                self._engine.setProperty("rate", rate)
            except Exception:
                pass

    def set_volume(self, volume: float) -> None:
        """Adjusts speech volume (0.0 to 1.0)."""
        self.volume = max(0.0, min(1.0, volume))
        if self._engine:
            try:
                self._engine.setProperty("volume", self.volume)
            except Exception:
                pass

    def stop(self) -> None:
        """Cleanly stops the background speech worker on application exit."""
        self.clear_and_stop()
        self._stop_event.set()
        try:
            self._queue.put_nowait(None)
        except Exception:
            pass
        if self._worker_thread and self._worker_thread.is_alive():
            self._worker_thread.join(timeout=1.0)
        print("[SpeechEngine] Cleanly stopped speech thread.")
