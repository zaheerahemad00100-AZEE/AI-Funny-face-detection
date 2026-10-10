"""
=============================================================
           AI FUNNY FACE COMMENTATOR - MAIN APPLICATION
=============================================================
A real-time computer vision AR camera filter that tracks multiple faces,
glows with neon cyber outlines, detects reactions (mouth open, smile),
serves 40+ hilarious Hinglish & English comments, speaks them via TTS,
and is controlled with interactive START and END SESSION buttons.

Controls:
  [ENTER]      : Start Session (Activate face detection & commentary)
  [E]          : End Session (Immediately stop detection & speech)
  [SPACE]      : Pause / Resume camera video feed
  [C]          : Force next funny comment
  [M]          : Mute / Unmute voice commentary (TTS)
  [V]          : Repeat current voice comment
  [S]          : Save snapshot image to disk
  [Q] or [ESC] : Quit application cleanly
  * Mouse Click: Click [START SESSION] or [END SESSION] buttons on screen!
=============================================================
"""

import sys
import os

# Suppress noisy TensorFlow Lite / MediaPipe C++ log output
os.environ["GLOG_minloglevel"] = "2"
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"

import time
from datetime import datetime
import numpy as np

# Ensure local modules can be imported
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from face_tracker import FaceTracker
from comment_engine import CommentEngine
from effects import VisualEffects
from speech_engine import SpeechEngine

# Global session state for mouse click handlers
g_session_active = False
g_speech_engine = None
g_comment_engine = None
g_face_tracker = None


def on_mouse_click(event, x, y, flags, param):
    """
    Handles mouse clicks on the on-screen [START SESSION] and [END SESSION] buttons.
    """
    global g_session_active, g_speech_engine, g_comment_engine, g_face_tracker

    import cv2
    if event == cv2.EVENT_LBUTTONDOWN:
        # Check START SESSION button bounds
        sx1, sy1, sx2, sy2 = VisualEffects.BTN_START
        if sx1 <= x <= sx2 and sy1 <= y <= sy2:
            if not g_session_active:
                g_session_active = True
                if g_comment_engine:
                    g_comment_engine.reset_session()
                if g_face_tracker:
                    g_face_tracker.reset_tracks()
                print("\n[AI-Funny-Face] ▶ SESSION ACTIVATED! Face detection, tracking, and commentary started.")
            return

        # Check END SESSION button bounds
        ex1, ey1, ex2, ey2 = VisualEffects.BTN_END
        if ex1 <= x <= ex2 and ey1 <= y <= ey2:
            if g_session_active:
                g_session_active = False
                if g_speech_engine:
                    g_speech_engine.clear_and_stop()
                if g_comment_engine:
                    g_comment_engine.reset_session()
                if g_face_tracker:
                    g_face_tracker.reset_tracks()
                print("\n[AI-Funny-Face] ⏹ SESSION ENDED. Face detection stopped and voice cleared.")
            return


def open_camera(preferred_index: int = 0):
    """
    Attempts to open the webcam gracefully. Tries index 0, then index 1.
    """
    import cv2
    print(f"[AI-Funny-Face] Attempting to open webcam (index {preferred_index})...")
    cap = cv2.VideoCapture(preferred_index)

    if not cap.isOpened():
        fallback_index = 1 if preferred_index == 0 else 0
        print(f"[AI-Funny-Face] Camera {preferred_index} unavailable. Trying fallback index {fallback_index}...")
        cap = cv2.VideoCapture(fallback_index)

    if not cap.isOpened():
        return None

    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
    cap.set(cv2.CAP_PROP_FPS, 30)
    return cap


def main():
    global g_session_active, g_speech_engine, g_comment_engine, g_face_tracker

    print("=" * 65)
    print("  AI FUNNY FACE COMMENTATOR - Starting Up...")
    print("=" * 65)

    try:
        import cv2
    except ImportError:
        print("[ERROR] OpenCV is not installed! Run: pip install -r requirements.txt")
        sys.exit(1)

    # 1. Initialize Comment Engine (Multi-face support, max 5 comments per face)
    g_comment_engine = CommentEngine(rotation_interval=2.8, max_comments_per_face=5)

    # 2. Initialize Multi-Face Tracker (up to 4 faces)
    print("[AI-Funny-Face] Initializing MediaPipe Multi-Face Tracker...")
    g_face_tracker = FaceTracker(max_faces=4, min_detection_confidence=0.5, min_tracking_confidence=0.5)

    # 3. Initialize Real-Time TTS Speech Engine
    print("[AI-Funny-Face] Initializing Real-time Speech Engine (pyttsx3)...")
    g_speech_engine = SpeechEngine(rate=175, volume=1.0, enabled=True)

    # 4. Open Webcam
    cap = open_camera(0)
    if cap is None:
        print("\n" + "!" * 65)
        print("[CAMERA ERROR] Could not open a physical webcam!")
        print("Possible causes:")
        print("  1. No webcam is connected to this machine.")
        print("  2. Another application (Zoom, Teams, Browser) is using the camera.")
        print("  3. Windows Camera privacy permissions are blocking Python.")
        print("!" * 65 + "\n")
        print("[AI-Funny-Face] Tip: Allow Camera access in Windows Settings -> Privacy -> Camera.")
        input("Press Enter to exit...")
        g_speech_engine.stop()
        return

    window_name = "AI Funny Face Commentator"
    cv2.namedWindow(window_name, cv2.WINDOW_NORMAL)
    cv2.resizeWindow(window_name, 1280, 720)
    cv2.setMouseCallback(window_name, on_mouse_click)

    # Initial state: Session is INACTIVE until user starts it!
    g_session_active = False

    print("\n[READY] Camera feed active! Application started in INACTIVE state.")
    print("  -> Click [START SESSION] button or press [ENTER] to begin face detection!")
    print("  -> Click [END SESSION] button or press [E] to stop detection & speech.")
    print("  -> Press [Q] or [ESC] to Quit cleanly.\n")

    # Runtime state variables
    prev_frame_time = time.time()
    fps = 30.0
    is_paused = False
    cached_frame = None
    snapshot_banner_time = 0.0

    try:
        while True:
            current_time = time.time()

            if not is_paused:
                ret, frame = cap.read()
                if not ret or frame is None:
                    print("[AI-Funny-Face] Warning: Dropped or empty frame. Retrying...")
                    time.sleep(0.03)
                    continue

                # Mirror frame for natural selfie feel
                frame = cv2.flip(frame, 1)

                # ONLY perform face detection when session is ACTIVE
                if g_session_active:
                    faces = g_face_tracker.process_frame(frame)
                else:
                    faces = []

                cached_frame = (frame.copy(), faces)
            else:
                if cached_frame is not None:
                    frame, faces = cached_frame[0].copy(), (cached_frame[1] if g_session_active else [])
                else:
                    time.sleep(0.03)
                    continue

            # Calculate rolling FPS
            delta_time = current_time - prev_frame_time
            if delta_time > 0:
                instant_fps = 1.0 / delta_time
                fps = (fps * 0.85) + (instant_fps * 0.15)
            prev_frame_time = current_time

            # -------------------------------------------------------------
            # RENDERING LOGIC
            # -------------------------------------------------------------
            if not g_session_active:
                # SESSION INACTIVE: Render clean standby card, no detection overlays
                VisualEffects.draw_session_inactive_card(frame, current_time)
            else:
                # SESSION ACTIVE: Render face tracking and face-specific comments
                if faces:
                    for face in faces:
                        face_id = face["id"]
                        reaction = face["reaction"]

                        # Update face-specific comment (max 5 comments per face)
                        comment, category, is_new, is_max = g_comment_engine.update_face(
                            face_id, reaction=reaction, force_next=False
                        )

                        # Announce comment through speakers if it's new
                        if is_new and not is_max and not is_paused:
                            g_speech_engine.speak(comment)

                        # 1. Glowing Face Oval Outline
                        theme_color = VisualEffects.COLOR_CYAN
                        if is_max:
                            theme_color = VisualEffects.COLOR_YELLOW
                        elif reaction == "shock":
                            theme_color = VisualEffects.COLOR_ORANGE
                        elif reaction == "smile":
                            theme_color = VisualEffects.COLOR_YELLOW

                        VisualEffects.draw_glowing_polygon(
                            frame, face["oval_points"], theme_color, current_time
                        )

                        # 2. Cyber Landmark Points
                        VisualEffects.draw_landmarks(
                            frame, face["cyber_points"], VisualEffects.COLOR_PURPLE
                        )

                        # 3. Floating Animated Comment Bubble for this face
                        VisualEffects.draw_floating_comment_bubble(
                            frame, comment, category, face, current_time, is_max_reached=is_max
                        )

            # Draw HUD with Start/End Session buttons, status badge, voice state & controls
            VisualEffects.draw_hud(
                frame,
                session_active=g_session_active,
                num_faces=len(faces) if g_session_active else 0,
                fps=fps,
                is_paused=is_paused,
                is_speech_muted=g_speech_engine.is_muted if g_speech_engine else False,
                speech_available=g_speech_engine.is_available if g_speech_engine else False,
            )

            # Snapshot save notification overlay
            if current_time - snapshot_banner_time < 1.8:
                cv2.putText(
                    frame,
                    "[ SNAPSHOT SAVED! ]",
                    (frame.shape[1] // 2 - 140, 80),
                    cv2.FONT_HERSHEY_DUPLEX,
                    0.75,
                    VisualEffects.COLOR_GREEN,
                    2,
                    cv2.LINE_AA,
                )

            # Display composite frame
            cv2.imshow(window_name, frame)

            # Key controls handling
            key = cv2.waitKey(1) & 0xFF

            # Exit: Q or ESC (27)
            if key == ord("q") or key == ord("Q") or key == 27:
                print("[AI-Funny-Face] Quitting application...")
                break

            # Start Session: ENTER (13 or 10)
            elif key == 13 or key == 10:
                if not g_session_active:
                    g_session_active = True
                    g_comment_engine.reset_session()
                    g_face_tracker.reset_tracks()
                    print("\n[AI-Funny-Face] ▶ SESSION STARTED via [ENTER] key.")

            # End Session: E or e or 0
            elif key == ord("e") or key == ord("E") or key == ord("0"):
                if g_session_active:
                    g_session_active = False
                    g_speech_engine.clear_and_stop()
                    g_comment_engine.reset_session()
                    g_face_tracker.reset_tracks()
                    print("\n[AI-Funny-Face] ⏹ SESSION ENDED via [E] key.")

            # Pause / Resume: Space (32)
            elif key == 32:
                is_paused = not is_paused
                status = "PAUSED" if is_paused else "RESUMED"
                print(f"[AI-Funny-Face] Playback {status}")

            # Force Next Comment for all active faces: C or c
            elif key == ord("c") or key == ord("C"):
                if g_session_active:
                    updated = g_comment_engine.trigger_force_next_all()
                    for fid, c, cat in updated:
                        g_speech_engine.speak(c, force=True)
                        print(f"[AI-Funny-Face] Forced next joke for {fid}: '{c}'")

            # Mute / Unmute Voice: M or m
            elif key == ord("m") or key == ord("M"):
                is_muted = g_speech_engine.toggle_mute()
                state_str = "MUTED" if is_muted else "ACTIVE"
                print(f"[AI-Funny-Face] Voice output is now {state_str}")

            # Repeat Current Comment: V or v
            elif key == ord("v") or key == ord("V"):
                if g_session_active:
                    g_speech_engine.repeat_current()

            # Save Snapshot: S or s
            elif key == ord("s") or key == ord("S"):
                filename = f"snapshot_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
                cv2.imwrite(filename, frame)
                snapshot_banner_time = current_time
                print(f"[AI-Funny-Face] Snapshot saved to: {filename}")

    except KeyboardInterrupt:
        print("[AI-Funny-Face] Interrupted by user.")
    finally:
        # Proper resource release
        print("[AI-Funny-Face] Cleaning up camera, speech, and window resources...")
        if g_speech_engine:
            g_speech_engine.stop()
        if cap is not None:
            cap.release()
        if g_face_tracker:
            g_face_tracker.release()
        cv2.destroyAllWindows()
        print("[AI-Funny-Face] Exited cleanly. Goodbye!")


if __name__ == "__main__":
    main()
