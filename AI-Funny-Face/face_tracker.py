"""
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

# Suppress TensorFlow Lite / MediaPipe C++ log output
os.environ["GLOG_minloglevel"] = "2"
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"


@contextmanager
def suppress_c_stderr():
    """
    Temporarily redirects C-level file descriptor 2 (stderr) to devnull
    to suppress noisy 'Created TensorFlow Lite XNNPACK delegate for CPU' info logs.
    """
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
    """
    Multi-face tracking and facial reaction analysis using MediaPipe Face Mesh.
    Extracts face oval contours, selected cyber landmark points, bounding boxes,
    and calculates smile and mouth-opening reactions for up to 4 faces independently.
    """

    # Key landmark indices in MediaPipe Face Mesh
    FACE_OVAL_INDICES: List[int] = [
        10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
        397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
        172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109
    ]

    CYBER_POINTS_INDICES: List[int] = [
        1, 4, 168, 197, 33, 133, 159, 145, 468, 362, 263, 386, 374, 473,
        70, 63, 105, 66, 107, 336, 296, 334, 293, 300, 61, 291, 0, 17, 13, 14,
        116, 345
    ]

    UPPER_LIP_CENTER: int = 13
    LOWER_LIP_CENTER: int = 14
    MOUTH_CORNER_LEFT: int = 61
    MOUTH_CORNER_RIGHT: int = 291
    FOREHEAD_TOP: int = 10
    CHIN_BOTTOM: int = 152
    LEFT_EYE_OUTER: int = 33
    RIGHT_EYE_OUTER: int = 263
    NOSE_TIP: int = 1

    def __init__(self, max_faces: int = 4, min_detection_confidence: float = 0.5, min_tracking_confidence: float = 0.5):
        self.max_faces = max_faces
        self.mp_face_mesh = None
        self.face_mesh = None
        self.is_initialized = False

        # Persistent face tracking across frames
        self._tracked_faces: Dict[str, Dict[str, Any]] = {}  # {face_id: {'center': (x,y), 'last_seen': time}}
        self._next_face_counter: int = 1

        self._init_mediapipe(min_detection_confidence, min_tracking_confidence)

    def _init_mediapipe(self, min_det: float, min_track: float) -> None:
        try:
            with suppress_c_stderr():
                import mediapipe as mp
                self.mp_face_mesh = mp.solutions.face_mesh
                self.face_mesh = self.mp_face_mesh.FaceMesh(
                    max_num_faces=self.max_faces,
                    refine_landmarks=True,
                    min_detection_confidence=min_det,
                    min_tracking_confidence=min_track
                )
            self.is_initialized = True
        except Exception as e:
            print(f"[FaceTracker] Warning: MediaPipe FaceMesh initialization error: {e}")
            self.is_initialized = False

    def reset_tracks(self) -> None:
        """Clears active tracked faces history on session restart."""
        self._tracked_faces.clear()
        self._next_face_counter = 1

    def process_frame(self, frame_bgr: np.ndarray) -> List[Dict[str, Any]]:
        """
        Processes a BGR frame and returns a list of tracked face dicts.
        Returns empty list if no face is detected.
        """
        if not self.is_initialized or self.face_mesh is None:
            return []

        import cv2

        h, w = frame_bgr.shape[:2]
        rgb_frame = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        rgb_frame.flags.writeable = False
        results = self.face_mesh.process(rgb_frame)

        if not results.multi_face_landmarks:
            # Purge stale tracks older than 1.5s
            now = time.time()
            stale = [fid for fid, data in self._tracked_faces.items() if now - data["last_seen"] > 1.5]
            for fid in stale:
                del self._tracked_faces[fid]
            return []

        current_time = time.time()
        detected_raw_faces = []

        # Extract landmarks for each detected face
        for face_landmarks in results.multi_face_landmarks:
            landmark_list = face_landmarks.landmark
            pts_2d = []
            for lm in landmark_list:
                px = int(lm.x * w)
                py = int(lm.y * h)
                pts_2d.append((px, py))

            # Bounding box
            xs = [p[0] for p in pts_2d]
            ys = [p[1] for p in pts_2d]
            x_min, x_max = max(0, min(xs)), min(w - 1, max(xs))
            y_min, y_max = max(0, min(ys)), min(h - 1, max(ys))
            center_x = (x_min + x_max) // 2
            center_y = (y_min + y_max) // 2
            face_w = x_max - x_min
            face_h = y_max - y_min

            # Face oval points
            oval_points = [pts_2d[idx] for idx in self.FACE_OVAL_INDICES if idx < len(pts_2d)]
            oval_array = np.array(oval_points, dtype=np.int32)

            # Cyber points
            cyber_points = [pts_2d[idx] for idx in self.CYBER_POINTS_INDICES if idx < len(pts_2d)]

            # Reaction analysis
            reaction, metrics = self._analyze_reaction(pts_2d, face_h, face_w)

            top_head = pts_2d[self.FOREHEAD_TOP] if self.FOREHEAD_TOP < len(pts_2d) else (center_x, y_min)
            chin = pts_2d[self.CHIN_BOTTOM] if self.CHIN_BOTTOM < len(pts_2d) else (center_x, y_max)

            detected_raw_faces.append({
                "center": (center_x, center_y),
                "bbox": (x_min, y_min, x_max, y_max),
                "width": face_w,
                "height": face_h,
                "oval_points": oval_array,
                "cyber_points": cyber_points,
                "reaction": reaction,
                "metrics": metrics,
                "top_head": top_head,
                "chin": chin
            })

        # Associate each detected face with a persistent face ID
        matched_faces = self._associate_faces(detected_raw_faces, current_time)
        return matched_faces

    def _associate_faces(self, raw_faces: List[Dict[str, Any]], current_time: float) -> List[Dict[str, Any]]:
        """
        Matches raw face detections to persistent IDs using centroid distance tracking.
        """
        output = []
        unmatched_raw = list(range(len(raw_faces)))
        active_ids = list(self._tracked_faces.keys())

        # Match existing IDs first
        for face_id in active_ids:
            old_center = self._tracked_faces[face_id]["center"]
            best_idx = None
            best_dist = float("inf")

            for idx in unmatched_raw:
                raw_center = raw_faces[idx]["center"]
                dist = math.hypot(raw_center[0] - old_center[0], raw_center[1] - old_center[1])
                # Threshold for same face movement between frames
                if dist < 140 and dist < best_dist:
                    best_dist = dist
                    best_idx = idx

            if best_idx is not None:
                face_data = raw_faces[best_idx]
                face_data["id"] = face_id
                self._tracked_faces[face_id]["center"] = face_data["center"]
                self._tracked_faces[face_id]["last_seen"] = current_time
                output.append(face_data)
                unmatched_raw.remove(best_idx)

        # For remaining unmatched detections, assign a new face ID
        for idx in unmatched_raw:
            new_id = f"Face #{self._next_face_counter}"
            self._next_face_counter += 1
            face_data = raw_faces[idx]
            face_data["id"] = new_id
            self._tracked_faces[new_id] = {
                "center": face_data["center"],
                "last_seen": current_time
            }
            output.append(face_data)

        # Remove stale tracks that disappeared > 1.8s ago
        stale_ids = [fid for fid, data in self._tracked_faces.items() if current_time - data["last_seen"] > 1.8]
        for fid in stale_ids:
            del self._tracked_faces[fid]

        return output

    def _analyze_reaction(self, pts: List[Tuple[int, int]], face_h: int, face_w: int) -> Tuple[str, Dict[str, float]]:
        if face_h <= 0 or face_w <= 0:
            return "neutral", {}
        try:
            up_lip = pts[self.UPPER_LIP_CENTER]
            low_lip = pts[self.LOWER_LIP_CENTER]
            mouth_l = pts[self.MOUTH_CORNER_LEFT]
            mouth_r = pts[self.MOUTH_CORNER_RIGHT]
            eye_l = pts[self.LEFT_EYE_OUTER]
            eye_r = pts[self.RIGHT_EYE_OUTER]

            lip_dist = math.hypot(low_lip[0] - up_lip[0], low_lip[1] - up_lip[1])
            mouth_open_ratio = lip_dist / max(1.0, face_h)

            mouth_width = math.hypot(mouth_r[0] - mouth_l[0], mouth_r[1] - mouth_l[1])
            eye_dist = math.hypot(eye_r[0] - eye_l[0], eye_r[1] - eye_l[1])
            smile_ratio = mouth_width / max(1.0, eye_dist)

            metrics = {
                "mouth_open_ratio": round(mouth_open_ratio, 3),
                "smile_ratio": round(smile_ratio, 3)
            }

            if mouth_open_ratio > 0.085:
                return "shock", metrics
            elif smile_ratio > 0.62:
                return "smile", metrics
            return "neutral", metrics
        except Exception:
            return "neutral", {}

    def release(self) -> None:
        """Closes the MediaPipe FaceMesh session."""
        if self.face_mesh:
            try:
                self.face_mesh.close()
            except Exception:
                pass
            self.face_mesh = None
        self._tracked_faces.clear()
