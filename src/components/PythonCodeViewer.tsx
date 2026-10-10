import React, { useState } from 'react';
import { Terminal, Copy, Check, FileCode, Download, ShieldCheck, PlayCircle } from 'lucide-react';

interface FileDefinition {
  name: string;
  path: string;
  desc: string;
  content: string;
}

const PYTHON_FILES: FileDefinition[] = [
  {
    name: 'main.py',
    path: 'AI-Funny-Face/main.py',
    desc: 'Application entry point: button-controlled sessions (Start/End Session), multi-face loop, mouse click listener.',
    content: `"""
AI FUNNY FACE COMMENTATOR - MAIN APPLICATION
A real-time computer vision AR camera filter that tracks multiple faces,
glows with neon cyber outlines, detects reactions (mouth open, smile),
serves 40+ funny comments, speaks them via TTS, and is controlled
with interactive START and END SESSION buttons.

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
"""

import sys
import os

os.environ["GLOG_minloglevel"] = "2"
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"

import time
from datetime import datetime
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from face_tracker import FaceTracker
from comment_engine import CommentEngine
from effects import VisualEffects
from speech_engine import SpeechEngine

g_session_active = False
g_speech_engine = None
g_comment_engine = None
g_face_tracker = None


def on_mouse_click(event, x, y, flags, param):
    global g_session_active, g_speech_engine, g_comment_engine, g_face_tracker
    import cv2
    if event == cv2.EVENT_LBUTTONDOWN:
        sx1, sy1, sx2, sy2 = VisualEffects.BTN_START
        if sx1 <= x <= sx2 and sy1 <= y <= sy2:
            if not g_session_active:
                g_session_active = True
                if g_comment_engine:
                    g_comment_engine.reset_session()
                if g_face_tracker:
                    g_face_tracker.reset_tracks()
                print("\\n[AI-Funny-Face] ▶ SESSION ACTIVATED! Face detection & commentary started.")
            return

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
                print("\\n[AI-Funny-Face] ⏹ SESSION ENDED. Face detection stopped and voice cleared.")
            return


def open_camera(preferred_index: int = 0):
    import cv2
    cap = cv2.VideoCapture(preferred_index)
    if not cap.isOpened():
        fallback_index = 1 if preferred_index == 0 else 0
        cap = cv2.VideoCapture(fallback_index)
    if not cap.isOpened():
        return None
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
    cap.set(cv2.CAP_PROP_FPS, 30)
    return cap


def main():
    global g_session_active, g_speech_engine, g_comment_engine, g_face_tracker

    import cv2
    g_comment_engine = CommentEngine(rotation_interval=2.8, max_comments_per_face=5)
    g_face_tracker = FaceTracker(max_faces=4, min_detection_confidence=0.5, min_tracking_confidence=0.5)
    g_speech_engine = SpeechEngine(rate=175, volume=1.0, enabled=True)

    cap = open_camera(0)
    if cap is None:
        print("[CAMERA ERROR] Could not open a physical webcam!")
        input("Press Enter to exit...")
        g_speech_engine.stop()
        return

    window_name = "AI Funny Face Commentator"
    cv2.namedWindow(window_name, cv2.WINDOW_NORMAL)
    cv2.resizeWindow(window_name, 1280, 720)
    cv2.setMouseCallback(window_name, on_mouse_click)

    g_session_active = False
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
                    time.sleep(0.03)
                    continue

                frame = cv2.flip(frame, 1)

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

            delta_time = current_time - prev_frame_time
            if delta_time > 0:
                instant_fps = 1.0 / delta_time
                fps = (fps * 0.85) + (instant_fps * 0.15)
            prev_frame_time = current_time

            if not g_session_active:
                VisualEffects.draw_session_inactive_card(frame, current_time)
            else:
                if faces:
                    for face in faces:
                        comment, category, is_new, is_max = g_comment_engine.update_face(
                            face["id"], reaction=face["reaction"]
                        )
                        if is_new and not is_max and not is_paused:
                            g_speech_engine.speak(comment)

                        theme_color = VisualEffects.COLOR_CYAN
                        if is_max:
                            theme_color = VisualEffects.COLOR_YELLOW
                        elif face["reaction"] == "shock":
                            theme_color = VisualEffects.COLOR_ORANGE
                        elif face["reaction"] == "smile":
                            theme_color = VisualEffects.COLOR_YELLOW

                        VisualEffects.draw_glowing_polygon(frame, face["oval_points"], theme_color, current_time)
                        VisualEffects.draw_landmarks(frame, face["cyber_points"], VisualEffects.COLOR_PURPLE)
                        VisualEffects.draw_floating_comment_bubble(
                            frame, comment, category, face, current_time, is_max_reached=is_max
                        )

            VisualEffects.draw_hud(
                frame,
                session_active=g_session_active,
                num_faces=len(faces) if g_session_active else 0,
                fps=fps,
                is_paused=is_paused,
                is_speech_muted=g_speech_engine.is_muted if g_speech_engine else False,
                speech_available=g_speech_engine.is_available if g_speech_engine else False,
            )

            cv2.imshow(window_name, frame)
            key = cv2.waitKey(1) & 0xFF

            if key == ord("q") or key == ord("Q") or key == 27:
                break
            elif key == 13 or key == 10:  # ENTER
                if not g_session_active:
                    g_session_active = True
                    g_comment_engine.reset_session()
                    g_face_tracker.reset_tracks()
            elif key == ord("e") or key == ord("E") or key == ord("0"):
                if g_session_active:
                    g_session_active = False
                    g_speech_engine.clear_and_stop()
                    g_comment_engine.reset_session()
                    g_face_tracker.reset_tracks()
            elif key == 32:
                is_paused = not is_paused
            elif key == ord("c") or key == ord("C"):
                if g_session_active:
                    for fid, c, cat in g_comment_engine.trigger_force_next_all():
                        g_speech_engine.speak(c, force=True)
            elif key == ord("m") or key == ord("M"):
                g_speech_engine.toggle_mute()
            elif key == ord("v") or key == ord("V"):
                if g_session_active:
                    g_speech_engine.repeat_current()
            elif key == ord("s") or key == ord("S"):
                filename = f"snapshot_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
                cv2.imwrite(filename, frame)

    finally:
        if g_speech_engine:
            g_speech_engine.stop()
        if cap is not None:
            cap.release()
        if g_face_tracker:
            g_face_tracker.release()
        cv2.destroyAllWindows()


if __name__ == "__main__":
    main()`,
  },
  {
    name: 'comment_engine.py',
    path: 'AI-Funny-Face/comment_engine.py',
    desc: 'Multi-face comment engine: max 5 comments per face, unique assignments per face, session resets.',
    content: `"""
AI Funny Face Commentator - Multi-Face Comment Engine
Manages face-specific comments, assigns max 4-5 unique comments per face appearance,
ensures unique assignments across multiple simultaneous faces, and manages session state.
"""

import time
import random
from typing import List, Dict, Optional, Tuple, Set


class FaceCommentRecord:
    def __init__(self, face_id: str, max_comments: int = 5):
        self.face_id = face_id
        self.max_comments = max_comments
        self.comments_seen: List[str] = []
        self.current_comment: str = ""
        self.current_category: str = "SWAG ALERT"
        self.last_update_time: float = 0.0
        self.last_reaction: str = "neutral"
        self.is_max_reached: bool = False
        self.comment_count: int = 0


class CommentEngine:
    DEFAULT_GENERAL_COMMENTS = [
        "😂 Average Human",
        "😎 Looking Good",
        "✨ Beautiful",
        "🔥 So Beautiful",
        "👑 Gorgeous",
        "🗿 Handsome",
        "💎 Very Handsome",
        "🚀 LEGENDARY LOOKS",
        "👽 Out of This World",
        "😏 Too Much Swag",
        "🌟 Superstar Detected",
        "🦁 King Energy",
        "💯 Absolute Legend",
        "🔥 Certified Heartthrob",
        "😎 Main Character Energy",
        "👑 Royal Vibes",
        "✨ Pure Charisma",
        "🚨 Handsomeness Alert",
        "💎 Premium Looks",
        "🕶️ Style Icon",
        "⚡ Aura Level: 100",
        "🌍 Center of Attention",
        "🏆 Born to Stand Out",
        "😍 Camera's Favorite",
        "🚀 Next-Level Looks",
        "🐐 The GOAT Has Arrived",
        "🔥 Unstoppable Charm",
        "💫 Walking Masterpiece",
        "👔 Gentleman Mode: ON",
        "👾 Legendary Human Unlocked"
    ]

    DEFAULT_SHOCK_COMMENTS = [
        "😲 Mind Blown: Shocked Expression!",
        "😲 Astonishing Looks Detected!",
        "😲 Jaw Drop Moment: 100% Shock!",
        "😲 Out of This World Reaction!"
    ]

    DEFAULT_SMILE_COMMENTS = [
        "😄 That's a Beautiful Smile!",
        "😄 Million Dollar Smile Confirmed!",
        "😄 1000 Watt Smile Detected!",
        "😄 Pure Joy and Brightness!"
    ]

    def __init__(self, rotation_interval: float = 2.8, max_comments_per_face: int = 5):
        self.rotation_interval = rotation_interval
        self.max_comments_per_face = max_comments_per_face
        self.general_comments = list(self.DEFAULT_GENERAL_COMMENTS)
        self.shock_comments = list(self.DEFAULT_SHOCK_COMMENTS)
        self.smile_comments = list(self.DEFAULT_SMILE_COMMENTS)
        self.face_records: Dict[str, FaceCommentRecord] = {}

    def reset_session(self) -> None:
        self.face_records.clear()

    def get_active_assigned_comments(self, exclude_face_id: Optional[str] = None) -> Set[str]:
        assigned = set()
        for fid, rec in self.face_records.items():
            if fid != exclude_face_id and rec.current_comment:
                assigned.add(rec.current_comment)
        return assigned

    def _pick_next_comment(self, record: FaceCommentRecord, reason: str = "SWAG") -> Tuple[str, str]:
        pool = self.shock_comments if reason == "SHOCK" else (self.smile_comments if reason == "SMILE" else self.general_comments)
        category = "SURPRISE!" if reason == "SHOCK" else ("SMILE LEGEND" if reason == "SMILE" else "SWAG ALERT")
        other_face_comments = self.get_active_assigned_comments(exclude_face_id=record.face_id)
        available = [c for c in pool if c not in record.comments_seen and c not in other_face_comments]
        if not available:
            available = [c for c in pool if c not in record.comments_seen]
        if not available:
            available = pool
        return random.choice(available), category

    def update_face(self, face_id: str, reaction: str = "neutral", force_next: bool = False) -> Tuple[str, str, bool, bool]:
        now = time.time()
        if face_id not in self.face_records:
            rec = FaceCommentRecord(face_id, max_comments=self.max_comments_per_face)
            c, cat = self._pick_next_comment(rec, reason="SWAG")
            rec.current_comment = c
            rec.current_category = cat
            rec.comments_seen.append(c)
            rec.comment_count = 1
            rec.last_update_time = now
            self.face_records[face_id] = rec
            return c, cat, True, False

        rec = self.face_records[face_id]
        if rec.is_max_reached:
            return rec.current_comment, "MAX SWAG REACHED", False, True

        is_reaction = ((reaction == "shock" and rec.last_reaction != "shock") or (reaction == "smile" and rec.last_reaction != "smile"))
        is_time = (now - rec.last_update_time >= self.rotation_interval)
        rec.last_reaction = reaction

        if force_next or is_reaction or is_time:
            if rec.comment_count >= rec.max_comments:
                rec.is_max_reached = True
                rec.current_comment = "CERTIFIED LEGEND: MAX SWAG UNLOCKED!"
                rec.current_category = "MAX SWAG REACHED"
                return rec.current_comment, rec.current_category, True, True

            reason = "SHOCK" if reaction == "shock" else ("SMILE" if reaction == "smile" else "SWAG")
            c, cat = self._pick_next_comment(rec, reason=reason)
            rec.current_comment = c
            rec.current_category = cat
            rec.comments_seen.append(c)
            rec.comment_count += 1
            rec.last_update_time = now
            return c, cat, True, False

        return rec.current_comment, rec.current_category, False, False

    def trigger_force_next_all(self) -> List[Tuple[str, str, str]]:
        results = []
        for fid in list(self.face_records.keys()):
            c, cat, is_new, is_max = self.update_face(fid, force_next=True)
            if is_new and not is_max:
                results.append((fid, c, cat))
        return results`,
  },
  {
    name: 'face_tracker.py',
    path: 'AI-Funny-Face/face_tracker.py',
    desc: 'Multi-face tracking (up to 4 faces) with centroid distance tracking and persistent face IDs.',
    content: `"""
AI Funny Face Commentator - Multi-Face Tracker Module
Utilizes MediaPipe 0.10.x Face Mesh to track multiple faces independently,
maintains stable face IDs across frames, and extracts oval contours and reaction metrics.
"""

import os
import sys
import math
import time
from contextlib import contextmanager
from typing import Optional, Dict, Any, List, Tuple
import numpy as np

os.environ["GLOG_minloglevel"] = "2"
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"


@contextmanager
def suppress_c_stderr():
    save_fds = None
    try:
        null_fds = os.open(os.devnull, os.O_RDWR)
        save_fds = os.dup(2)
        os.dup2(null_fds, 2)
        os.close(null_fds)
        yield
    except Exception:
        yield
    finally:
        if save_fds is not None:
            try:
                os.dup2(save_fds, 2)
                os.close(save_fds)
            except Exception:
                pass


class FaceTracker:
    FACE_OVAL_INDICES = [
        10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
        397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
        172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109
    ]
    CYBER_POINTS_INDICES = [
        1, 4, 168, 197, 33, 133, 159, 145, 468, 362, 263, 386, 374, 473,
        70, 63, 105, 66, 107, 336, 296, 334, 293, 300, 61, 291, 0, 17, 13, 14,
        116, 345
    ]

    def __init__(self, max_faces: int = 4, min_detection_confidence: float = 0.5, min_tracking_confidence: float = 0.5):
        self.max_faces = max_faces
        self._tracked_faces: Dict[str, Dict[str, Any]] = {}
        self._next_face_counter: int = 1
        with suppress_c_stderr():
            import mediapipe as mp
            self.face_mesh = mp.solutions.face_mesh.FaceMesh(
                max_num_faces=self.max_faces,
                refine_landmarks=True,
                min_detection_confidence=min_detection_confidence,
                min_tracking_confidence=min_tracking_confidence
            )

    def reset_tracks(self) -> None:
        self._tracked_faces.clear()
        self._next_face_counter = 1

    def process_frame(self, frame_bgr: np.ndarray) -> List[Dict[str, Any]]:
        import cv2
        h, w = frame_bgr.shape[:2]
        rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        rgb.flags.writeable = False
        results = self.face_mesh.process(rgb)
        if not results.multi_face_landmarks:
            return []

        now = time.time()
        raw_faces = []
        for lm_list in results.multi_face_landmarks:
            pts = [(int(p.x * w), int(p.y * h)) for p in lm_list.landmark]
            xs = [p[0] for p in pts]
            ys = [p[1] for p in pts]
            x_min, x_max = max(0, min(xs)), min(w - 1, max(xs))
            y_min, y_max = max(0, min(ys)), min(h - 1, max(ys))
            cx, cy = (x_min + x_max) // 2, (y_min + y_max) // 2
            oval = np.array([pts[i] for i in self.FACE_OVAL_INDICES if i < len(pts)], dtype=np.int32)
            cyber = [pts[i] for i in self.CYBER_POINTS_INDICES if i < len(pts)]

            # Reaction
            lip_dist = math.hypot(pts[14][0] - pts[13][0], pts[14][1] - pts[13][1])
            m_open = lip_dist / max(1.0, y_max - y_min)
            m_w = math.hypot(pts[291][0] - pts[61][0], pts[291][1] - pts[61][1])
            e_dist = math.hypot(pts[263][0] - pts[33][0], pts[263][1] - pts[33][1])
            smile_r = m_w / max(1.0, e_dist)
            rx = "shock" if m_open > 0.085 else ("smile" if smile_r > 0.62 else "neutral")

            raw_faces.append({
                "center": (cx, cy), "bbox": (x_min, y_min, x_max, y_max),
                "oval_points": oval, "cyber_points": cyber, "reaction": rx,
                "top_head": pts[10] if 10 < len(pts) else (cx, y_min)
            })

        # Match persistent IDs
        output = []
        unmatched = list(range(len(raw_faces)))
        for fid in list(self._tracked_faces.keys()):
            old_c = self._tracked_faces[fid]["center"]
            best_idx = None
            best_d = 140
            for i in unmatched:
                d = math.hypot(raw_faces[i]["center"][0] - old_c[0], raw_faces[i]["center"][1] - old_c[1])
                if d < best_d:
                    best_d = d
                    best_idx = i
            if best_idx is not None:
                f = raw_faces[best_idx]
                f["id"] = fid
                self._tracked_faces[fid] = {"center": f["center"], "last_seen": now}
                output.append(f)
                unmatched.remove(best_idx)

        for i in unmatched:
            new_id = f"Face #{self._next_face_counter}"
            self._next_face_counter += 1
            f = raw_faces[i]
            f["id"] = new_id
            self._tracked_faces[new_id] = {"center": f["center"], "last_seen": now}
            output.append(f)

        return output

    def release(self) -> None:
        if self.face_mesh:
            self.face_mesh.close()`,
  },
  {
    name: 'speech_engine.py',
    path: 'AI-Funny-Face/speech_engine.py',
    desc: 'Non-blocking offline pyttsx3 TTS with immediate clear_and_stop() cancellation on End Session.',
    content: `"""
AI Funny Face Commentator - Text-to-Speech Engine
Offline speech engine with clear_and_stop() support for clean session transitions.
"""

import threading
import queue
from typing import Optional


class SpeechEngine:
    def __init__(self, rate: int = 175, volume: float = 1.0, enabled: bool = True):
        self.rate = rate
        self.volume = volume
        self.is_muted = not enabled
        self.is_available = False
        self._queue = queue.Queue(maxsize=8)
        self._last_spoken_text = ""
        self._stop_event = threading.Event()
        self._engine = None
        self._worker_thread = threading.Thread(target=self._run_worker, name="TTS-Worker", daemon=True)
        self._worker_thread.start()

    def _run_worker(self) -> None:
        try:
            import pyttsx3
            self._engine = pyttsx3.init()
            self._engine.setProperty("rate", self.rate)
            self._engine.setProperty("volume", self.volume)
            self.is_available = True
        except Exception:
            self.is_available = False

        while not self._stop_event.is_set():
            try:
                item = self._queue.get(timeout=0.2)
                if item is None:
                    break
                text, force = item
                if self.is_muted and not force:
                    self._queue.task_done()
                    continue
                if self.is_available and self._engine and not self._stop_event.is_set():
                    try:
                        self._engine.say(text)
                        self._engine.runAndWait()
                        self._last_spoken_text = text
                    except Exception:
                        pass
                self._queue.task_done()
            except queue.Empty:
                continue

        if self._engine:
            try:
                self._engine.stop()
            except Exception:
                pass

    def speak(self, text: str, force: bool = False) -> None:
        if not text or not text.strip():
            return
        trimmed = text.strip()
        if not force and trimmed == self._last_spoken_text:
            return
        if self.is_muted and not force:
            self._last_spoken_text = trimmed
            return
        while not self._queue.empty():
            try:
                self._queue.get_nowait()
                self._queue.task_done()
            except Exception:
                break
        try:
            self._queue.put_nowait((trimmed, force))
            self._last_spoken_text = trimmed
        except queue.Full:
            pass

    def clear_and_stop(self) -> None:
        while not self._queue.empty():
            try:
                self._queue.get_nowait()
                self._queue.task_done()
            except Exception:
                break
        if self._engine:
            try:
                self._engine.stop()
            except Exception:
                pass
        self._last_spoken_text = ""

    def repeat_current(self) -> None:
        if self._last_spoken_text:
            self.speak(self._last_spoken_text, force=True)

    def toggle_mute(self) -> bool:
        self.is_muted = not self.is_muted
        if self.is_muted:
            self.clear_and_stop()
        return self.is_muted

    def stop(self) -> None:
        self.clear_and_stop()
        self._stop_event.set()
        try:
            self._queue.put_nowait(None)
        except Exception:
            pass
        if self._worker_thread and self._worker_thread.is_alive():
            self._worker_thread.join(timeout=1.0)`,
  },
  {
    name: 'effects.py',
    path: 'AI-Funny-Face/effects.py',
    desc: 'Interactive Start/End buttons, multi-face comment bubbles, and session standby HUD.',
    content: `"""
AI Funny Face Commentator - Effects Module
Renders Start/End session buttons, multi-face bubbles, and standby screens.
"""

import math
from typing import Tuple, List, Dict, Any
import numpy as np
import cv2


class VisualEffects:
    COLOR_CYAN = (255, 235, 0)
    COLOR_PURPLE = (255, 60, 180)
    COLOR_ORANGE = (30, 140, 255)
    COLOR_YELLOW = (40, 220, 255)
    COLOR_GREEN = (80, 240, 100)
    COLOR_ROSE = (80, 50, 240)
    COLOR_WHITE = (255, 255, 255)
    COLOR_BLACK = (10, 10, 15)
    COLOR_CARD_BG = (20, 18, 30)
    COLOR_BTN_BG = (30, 26, 42)

    BTN_START = (18, 54, 200, 92)
    BTN_END = (212, 54, 385, 92)

    @classmethod
    def draw_hud(cls, image: np.ndarray, session_active: bool, num_faces: int, fps: float,
                 is_paused: bool, is_speech_muted: bool = False, speech_available: bool = True) -> None:
        h, w = image.shape[:2]
        header = image.copy()
        cv2.rectangle(header, (0, 0), (w, 46), (12, 10, 20), -1)
        cv2.addWeighted(header, 0.85, image, 0.15, 0, image)
        cv2.line(image, (0, 46), (w, 46), cls.COLOR_CYAN, 1, cv2.LINE_AA)
        cv2.putText(image, "[ AI FUNNY FACE COMMENTATOR ]", (18, 28), cv2.FONT_HERSHEY_DUPLEX, 0.62, cls.COLOR_CYAN, 1, cv2.LINE_AA)

        status_col = cls.COLOR_GREEN if session_active else cls.COLOR_ORANGE
        status_text = f"SESSION ACTIVE ({num_faces} FACES)" if (session_active and num_faces > 0) else ("SESSION ACTIVE" if session_active else "SESSION INACTIVE")
        cv2.circle(image, (400, 24), 5, status_col, -1, lineType=cv2.LINE_AA)
        cv2.putText(image, status_text, (414, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.48, status_col, 1, cv2.LINE_AA)

        # Draw session buttons
        sx1, sy1, sx2, sy2 = cls.BTN_START
        ex1, ey1, ex2, ey2 = cls.BTN_END
        if not session_active:
            cv2.rectangle(image, (sx1, sy1), (sx2, sy2), cls.COLOR_GREEN, -1)
            cv2.putText(image, "START SESSION", (sx1 + 18, sy1 + 25), cv2.FONT_HERSHEY_DUPLEX, 0.52, cls.COLOR_BLACK, 2, cv2.LINE_AA)
            cv2.rectangle(image, (ex1, ey1), (ex2, ey2), cls.COLOR_BTN_BG, -1)
            cv2.putText(image, "END SESSION", (ex1 + 22, ey1 + 25), cv2.FONT_HERSHEY_SIMPLEX, 0.50, (80, 80, 95), 1, cv2.LINE_AA)
        else:
            cv2.rectangle(image, (sx1, sy1), (sx2, sy2), cls.COLOR_BTN_BG, -1)
            cv2.putText(image, "START SESSION", (sx1 + 18, sy1 + 25), cv2.FONT_HERSHEY_SIMPLEX, 0.50, (80, 80, 95), 1, cv2.LINE_AA)
            cv2.rectangle(image, (ex1, ey1), (ex2, ey2), cls.COLOR_ROSE, -1)
            cv2.putText(image, "END SESSION", (ex1 + 22, ey1 + 25), cv2.FONT_HERSHEY_DUPLEX, 0.52, cls.COLOR_WHITE, 2, cv2.LINE_AA)

    @classmethod
    def draw_session_inactive_card(cls, image: np.ndarray, time_val: float) -> None:
        h, w = image.shape[:2]
        cw, ch = 520, 130
        x1, y1 = (w - cw) // 2, (h - ch) // 2
        cv2.rectangle(image, (x1, y1), (x1 + cw, y1 + ch), cls.COLOR_CARD_BG, -1)
        cv2.rectangle(image, (x1, y1), (x1 + cw, y1 + ch), cls.COLOR_ORANGE, 2)
        cv2.putText(image, "SESSION INACTIVE", (x1 + 30, y1 + 36), cv2.FONT_HERSHEY_DUPLEX, 0.68, cls.COLOR_ORANGE, 2, cv2.LINE_AA)
        cv2.putText(image, "Click [START SESSION] button above or press ENTER", (x1 + 30, y1 + 70), cv2.FONT_HERSHEY_SIMPLEX, 0.50, cls.COLOR_WHITE, 1, cv2.LINE_AA)
        cv2.putText(image, "Face detection, tracking, comments & voice will activate.", (x1 + 30, y1 + 98), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (180, 180, 205), 1, cv2.LINE_AA)

    @classmethod
    def draw_floating_comment_bubble(cls, image: np.ndarray, comment: str, category: str,
                                     face_data: Dict[str, Any], time_val: float, is_max_reached: bool = False) -> None:
        h_frame, w_frame = image.shape[:2]
        x_min, y_min, x_max, y_max = face_data["bbox"]
        cx, _ = face_data["center"]
        fid = face_data.get("id", "Face #1")
        badge_text = f">> {fid} [MAX SWAG REACHED]" if is_max_reached else f">> {fid} | {category}"
        theme = cls.COLOR_YELLOW if is_max_reached else cls.COLOR_CYAN

        (tw, th), _ = cv2.getTextSize(comment, cv2.FONT_HERSHEY_DUPLEX, 0.65, 2)
        (bw, bh), _ = cv2.getTextSize(badge_text, cv2.FONT_HERSHEY_SIMPLEX, 0.42, 1)
        bw_total = max(tw, bw) + 44
        bh_total = th + bh + 44
        tx = max(20, min(w_frame - bw_total - 20, cx - bw_total // 2))
        ty = max(100, min(h_frame - bh_total - 45, y_min - bh_total - 20))

        cv2.rectangle(image, (tx, ty), (tx + bw_total, ty + bh_total), cls.COLOR_CARD_BG, -1)
        cv2.rectangle(image, (tx, ty), (tx + bw_total, ty + bh_total), theme, 2)
        cv2.putText(image, badge_text, (tx + 22, ty + 24), cv2.FONT_HERSHEY_SIMPLEX, 0.42, theme, 1, cv2.LINE_AA)
        cv2.putText(image, comment, (tx + 22, ty + 24 + th + 10), cv2.FONT_HERSHEY_DUPLEX, 0.65, cls.COLOR_WHITE, 2, cv2.LINE_AA)

    @staticmethod
    def draw_glowing_polygon(image: np.ndarray, points: np.ndarray, color: Tuple[int, int, int], time_val: float) -> None:
        if len(points) >= 3:
            cv2.polylines(image, [points], True, color, 2, cv2.LINE_AA)

    @staticmethod
    def draw_landmarks(image: np.ndarray, points: List[Tuple[int, int]], color: Tuple[int, int, int]) -> None:
        for pt in points:
            cv2.circle(image, pt, 2, color, -1, cv2.LINE_AA)`,
  },
  {
    name: 'requirements.txt',
    path: 'AI-Funny-Face/requirements.txt',
    desc: 'Exact Python dependency pins for Windows & Linux.',
    content: `# AI Funny Face Commentator Dependencies
opencv-python>=4.8.0.76
mediapipe>=0.10.14,<=0.10.21
numpy>=1.24.0,<2.0.0
pyttsx3>=2.90`,
  },
];

export const PythonCodeViewer: React.FC = () => {
  const [activeFile, setActiveFile] = useState<FileDefinition>(PYTHON_FILES[0]);
  const [copied, setCopied] = useState<boolean>(false);
  const [copiedCmd, setCopiedCmd] = useState<boolean>(false);

  const copyContent = () => {
    navigator.clipboard.writeText(activeFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyWindowsCommand = () => {
    const cmd = "cd AI-Funny-Face && python -m venv .venv && .venv\\Scripts\\activate && pip install -r requirements.txt && python main.py";
    navigator.clipboard.writeText(cmd);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  const downloadFile = (file: FileDefinition) => {
    const blob = new Blob([file.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full flex flex-col gap-6">
      {/* Quick Run Hero Card */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-950/40 border border-cyan-500/30">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <ShieldCheck className="w-5 h-5 text-cyan-400" />
              <h2 className="text-base font-bold font-orbitron tracking-wider text-cyan-300">
                BUTTON-CONTROLLED SESSIONS WITH MULTI-FACE TRACKING
              </h2>
            </div>
            <p className="text-xs text-slate-400">
              Run this single command inside Windows Command Prompt to set up the virtual environment and launch with interactive Start/End session buttons and multi-face speech commentary.
            </p>
          </div>
          <button
            onClick={copyWindowsCommand}
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs uppercase tracking-wider transition cursor-pointer shadow-lg shadow-cyan-500/25 shrink-0"
          >
            {copiedCmd ? <Check className="w-4 h-4 text-emerald-950" /> : <Copy className="w-4 h-4" />}
            <span>{copiedCmd ? 'Command Copied!' : 'Copy Windows Command'}</span>
          </button>
        </div>

        {/* Command block */}
        <div className="mt-4 p-3.5 rounded-xl bg-black/80 border border-slate-800 font-mono-code text-xs text-emerald-400 overflow-x-auto select-all">
          cd AI-Funny-Face &amp;&amp; python -m venv .venv &amp;&amp; .venv\\Scripts\\activate &amp;&amp; pip install -r requirements.txt &amp;&amp; python main.py
        </div>
      </div>

      {/* Code Browser */}
      <div className="rounded-3xl border border-slate-800 bg-slate-950 overflow-hidden shadow-xl">
        {/* File Tabs */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/60 px-4 py-2 overflow-x-auto">
          <div className="flex items-center gap-1.5">
            {PYTHON_FILES.map((file) => (
              <button
                key={file.name}
                onClick={() => setActiveFile(file)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-mono-code transition cursor-pointer ${
                  activeFile.name === file.name
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>{file.name}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 shrink-0 ml-4">
            <button
              onClick={() => downloadFile(activeFile)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono-code transition cursor-pointer"
              title="Download this file"
            >
              <Download className="w-3.5 h-3.5 text-slate-400" />
              <span>Download</span>
            </button>
            <button
              onClick={copyContent}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 text-xs font-mono-code border border-cyan-500/30 transition cursor-pointer"
              title="Copy file contents"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied!' : 'Copy Code'}</span>
            </button>
          </div>
        </div>

        {/* File description header */}
        <div className="px-6 py-3 bg-slate-900/30 border-b border-slate-800/80 flex items-center justify-between text-xs font-mono-code text-slate-400">
          <span>Path: <strong className="text-cyan-300">{activeFile.path}</strong></span>
          <span className="hidden sm:inline text-slate-500">{activeFile.desc}</span>
        </div>

        {/* Code Viewport */}
        <div className="p-6 bg-slate-950 font-mono-code text-xs text-slate-300 overflow-x-auto max-h-[520px] select-text">
          <pre className="leading-relaxed">
            <code>{activeFile.content}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};
