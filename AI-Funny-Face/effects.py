"""
AI Funny Face Commentator - Visual Effects & HUD Rendering Engine
Provides glowing outlines, cyber landmark constellations, floating comment bubbles,
interactive Start/End session buttons, multi-face tracking tags, and futuristic AR overlays.
"""

import math
from typing import Tuple, List, Dict, Any, Optional
import numpy as np
import cv2


class VisualEffects:
    """
    Renders cinematic AR effects with smooth neon glows, rounded translucent cards,
    interactive Start/End session buttons, and multi-face boundary-aware typography.
    """

    # BGR Color Palette
    COLOR_CYAN = (255, 235, 0)       # #00EBFF Neon Cyan
    COLOR_PURPLE = (255, 60, 180)    # #B43CFF Neon Purple
    COLOR_ORANGE = (30, 140, 255)    # #FF8C1E Neon Orange
    COLOR_YELLOW = (40, 220, 255)    # #FFDC28 Neon Gold
    COLOR_GREEN = (80, 240, 100)     # #64F050 Electric Green
    COLOR_ROSE = (80, 50, 240)       # #F03250 Rose/Red
    COLOR_WHITE = (255, 255, 255)
    COLOR_BLACK = (10, 10, 15)
    COLOR_CARD_BG = (20, 18, 30)
    COLOR_BTN_BG = (30, 26, 42)
    COLOR_DISABLED = (80, 80, 95)

    # Clickable Button Rectangles: (x1, y1, x2, y2)
    BTN_START = (18, 54, 200, 92)
    BTN_END = (212, 54, 385, 92)

    @staticmethod
    def draw_glowing_polygon(image: np.ndarray, points: np.ndarray, color_bgr: Tuple[int, int, int], time_val: float) -> None:
        """
        Draws a multi-layer pulsing neon glow around the face oval contour.
        """
        if len(points) < 3:
            return

        pulse = (math.sin(time_val * 4.0) + 1.0) / 2.0  # 0.0 to 1.0
        overlay = image.copy()

        # Layer 1: Wide soft aura
        glow_thickness = int(10 + 4 * pulse)
        cv2.polylines(overlay, [points], isClosed=True, color=color_bgr, thickness=glow_thickness, lineType=cv2.LINE_AA)
        cv2.addWeighted(overlay, 0.28, image, 0.72, 0, image)

        # Layer 2: Medium glow
        mid_overlay = image.copy()
        cv2.polylines(mid_overlay, [points], isClosed=True, color=color_bgr, thickness=5, lineType=cv2.LINE_AA)
        cv2.addWeighted(mid_overlay, 0.45, image, 0.55, 0, image)

        # Layer 3: Sharp crisp inner neon core
        core_color = (
            min(255, color_bgr[0] + 50),
            min(255, color_bgr[1] + 50),
            min(255, color_bgr[2] + 50)
        )
        cv2.polylines(image, [points], isClosed=True, color=core_color, thickness=2, lineType=cv2.LINE_AA)

    @staticmethod
    def draw_landmarks(image: np.ndarray, points: List[Tuple[int, int]], color_bgr: Tuple[int, int, int]) -> None:
        """
        Renders selected cyber landmark dots with subtle neon halos.
        """
        overlay = image.copy()
        for pt in points:
            cv2.circle(overlay, pt, 4, color_bgr, -1, lineType=cv2.LINE_AA)
        cv2.addWeighted(overlay, 0.35, image, 0.65, 0, image)

        for pt in points:
            cv2.circle(image, pt, 2, VisualEffects.COLOR_WHITE, -1, lineType=cv2.LINE_AA)

    @staticmethod
    def draw_rounded_rect(image: np.ndarray, top_left: Tuple[int, int], bottom_right: Tuple[int, int],
                          color: Tuple[int, int, int], radius: int = 12, fill: bool = True,
                          thickness: int = 2) -> None:
        """
        Draws a rounded rectangle on an image with anti-aliasing.
        """
        x1, y1 = top_left
        x2, y2 = bottom_right
        w = x2 - x1
        h = y2 - y1
        r = min(radius, w // 2, h // 2)

        if fill:
            cv2.rectangle(image, (x1 + r, y1), (x2 - r, y2), color, -1)
            cv2.rectangle(image, (x1, y1 + r), (x2, y2 - r), color, -1)
            cv2.circle(image, (x1 + r, y1 + r), r, color, -1, lineType=cv2.LINE_AA)
            cv2.circle(image, (x2 - r, y1 + r), r, color, -1, lineType=cv2.LINE_AA)
            cv2.circle(image, (x1 + r, y2 - r), r, color, -1, lineType=cv2.LINE_AA)
            cv2.circle(image, (x2 - r, y2 - r), r, color, -1, lineType=cv2.LINE_AA)
        else:
            cv2.line(image, (x1 + r, y1), (x2 - r, y1), color, thickness, lineType=cv2.LINE_AA)
            cv2.line(image, (x1 + r, y2), (x2 - r, y2), color, thickness, lineType=cv2.LINE_AA)
            cv2.line(image, (x1, y1 + r), (x1, y2 - r), color, thickness, lineType=cv2.LINE_AA)
            cv2.line(image, (x2, y1 + r), (x2, y2 - r), color, thickness, lineType=cv2.LINE_AA)
            cv2.ellipse(image, (x1 + r, y1 + r), (r, r), 180, 0, 90, color, thickness, lineType=cv2.LINE_AA)
            cv2.ellipse(image, (x2 - r, y1 + r), (r, r), 270, 0, 90, color, thickness, lineType=cv2.LINE_AA)
            cv2.ellipse(image, (x2 - r, y2 - r), (r, r), 0, 0, 90, color, thickness, lineType=cv2.LINE_AA)
            cv2.ellipse(image, (x1 + r, y2 - r), (r, r), 90, 0, 90, color, thickness, lineType=cv2.LINE_AA)

    @classmethod
    def draw_floating_comment_bubble(cls, image: np.ndarray, comment: str, category: str,
                                     face_data: Dict[str, Any], time_val: float,
                                     is_max_reached: bool = False) -> None:
        """
        Renders an intelligent floating comment card aligned to the tracked face,
        with subtle floating bob animation, dark translucent bubble, and face ID tag.
        """
        h_frame, w_frame = image.shape[:2]
        x_min, y_min, x_max, y_max = face_data["bbox"]
        center_x, _ = face_data["center"]
        face_id = face_data.get("id", "Face #1")

        # Determine theme color based on category / reaction / max reached
        if is_max_reached:
            theme_color = cls.COLOR_YELLOW
            badge_icon = f">> {face_id} [MAX SWAG REACHED]"
        elif category == "SURPRISE!" or face_data.get("reaction") == "shock":
            theme_color = cls.COLOR_ORANGE
            badge_icon = f">> {face_id} [SHOCK]"
        elif category == "SMILE LEGEND" or face_data.get("reaction") == "smile":
            theme_color = cls.COLOR_YELLOW
            badge_icon = f">> {face_id} [SMILE]"
        else:
            theme_color = cls.COLOR_CYAN
            badge_icon = f">> {face_id} [SWAG]"

        # Typography configuration
        font = cv2.FONT_HERSHEY_DUPLEX
        font_scale = 0.65
        thickness = 2

        (text_w, text_h), _ = cv2.getTextSize(comment, font, font_scale, thickness)
        badge_text = f"{badge_icon} | {category}"
        (badge_w, badge_h), _ = cv2.getTextSize(badge_text, cv2.FONT_HERSHEY_SIMPLEX, 0.42, 1)

        content_w = max(text_w, badge_w)
        pad_x = 22
        pad_y = 16
        bubble_w = content_w + (pad_x * 2)
        bubble_h = text_h + badge_h + (pad_y * 2) + 12

        # Floating vertical bob animation
        bob_offset = int(math.sin(time_val * 4.5) * 5.0)

        # Intelligent positioning logic
        target_x = center_x - (bubble_w // 2)
        target_y = y_min - bubble_h - 22 + bob_offset

        # If clipped at top, move to right of face
        if target_y < 100:
            target_y = y_min + 10 + bob_offset
            target_x = x_max + 22

            # If clipped at right, move to left of face
            if target_x + bubble_w > w_frame - 20:
                target_x = x_min - bubble_w - 22

                # If clipped on both sides, position below chin
                if target_x < 20:
                    target_x = center_x - (bubble_w // 2)
                    target_y = y_max + 22 + bob_offset

        # Clamp strictly inside visible frame margins
        target_x = max(20, min(w_frame - bubble_w - 20, target_x))
        target_y = max(100, min(h_frame - bubble_h - 45, target_y))

        # Render translucent dark backdrop
        backdrop = image.copy()
        x1, y1 = target_x, target_y
        x2, y2 = target_x + bubble_w, target_y + bubble_h

        cls.draw_rounded_rect(backdrop, (x1, y1), (x2, y2), cls.COLOR_CARD_BG, radius=14, fill=True)
        cv2.addWeighted(backdrop, 0.88, image, 0.12, 0, image)

        # Glowing accent border
        glow_layer = image.copy()
        cls.draw_rounded_rect(glow_layer, (x1 - 2, y1 - 2), (x2 + 2, y2 + 2), theme_color, radius=16, fill=False, thickness=4)
        cv2.addWeighted(glow_layer, 0.4, image, 0.6, 0, image)
        cls.draw_rounded_rect(image, (x1, y1), (x2, y2), theme_color, radius=14, fill=False, thickness=2)

        # Draw category pill / badge
        badge_y = y1 + pad_y + badge_h
        cv2.putText(image, badge_text, (x1 + pad_x, badge_y), cv2.FONT_HERSHEY_SIMPLEX, 0.42, theme_color, 1, cv2.LINE_AA)

        # Draw main punchline text
        text_y = badge_y + text_h + 10
        cv2.putText(image, comment, (x1 + pad_x + 1, text_y + 1), font, font_scale, cls.COLOR_BLACK, thickness + 1, cv2.LINE_AA)
        cv2.putText(image, comment, (x1 + pad_x, text_y), font, font_scale, cls.COLOR_WHITE, thickness, cv2.LINE_AA)

        # Cyber connector line pointing from bubble to head
        anchor_x = int(np.clip(center_x, x1 + 10, x2 - 10))
        anchor_y = y2 if target_y < y_min else y1
        target_point = face_data.get("top_head", (center_x, y_min))
        cv2.line(image, (anchor_x, anchor_y), (target_point[0], target_point[1]), theme_color, 1, cv2.LINE_AA)
        cv2.circle(image, (anchor_x, anchor_y), 3, theme_color, -1, lineType=cv2.LINE_AA)

    @classmethod
    def draw_hud(cls, image: np.ndarray, session_active: bool, num_faces: int, fps: float,
                 is_paused: bool, is_speech_muted: bool = False, speech_available: bool = True) -> None:
        """
        Draws futuristic cyber HUD bars, Start/End session buttons, status tags, and hotkey controls.
        """
        h_frame, w_frame = image.shape[:2]

        # Top Bar Background
        header_overlay = image.copy()
        cv2.rectangle(header_overlay, (0, 0), (w_frame, 46), (12, 10, 20), -1)
        cv2.addWeighted(header_overlay, 0.85, image, 0.15, 0, image)
        cv2.line(image, (0, 46), (w_frame, 46), cls.COLOR_CYAN, 1, cv2.LINE_AA)

        # App Title with Cyber brackets
        cv2.putText(image, "[ AI FUNNY FACE COMMENTATOR ]", (18, 28), cv2.FONT_HERSHEY_DUPLEX, 0.62, cls.COLOR_CYAN, 1, cv2.LINE_AA)

        # Session Status Indicator (Active vs Inactive)
        if session_active:
            status_text = "SESSION ACTIVE"
            status_col = cls.COLOR_GREEN
            cv2.circle(image, (400, 24), 5, status_col, -1, lineType=cv2.LINE_AA)
            cv2.putText(image, status_text, (414, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.48, status_col, 1, cv2.LINE_AA)

            if num_faces > 0:
                cv2.putText(image, f"| TRACKING {num_faces} FACE(S)", (570, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.46, cls.COLOR_CYAN, 1, cv2.LINE_AA)
            else:
                cv2.putText(image, "| SEARCHING FACE...", (570, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.46, cls.COLOR_ORANGE, 1, cv2.LINE_AA)
        else:
            status_text = "SESSION INACTIVE"
            status_col = cls.COLOR_ORANGE
            cv2.circle(image, (400, 24), 5, status_col, -1, lineType=cv2.LINE_AA)
            cv2.putText(image, status_text, (414, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.48, status_col, 1, cv2.LINE_AA)
            cv2.putText(image, "| CLICK START SESSION", (575, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.46, (180, 180, 200), 1, cv2.LINE_AA)

        # Voice Status Badge
        voice_x = w_frame - 310
        if not speech_available:
            cv2.putText(image, "[VOICE: N/A]", (voice_x, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.44, (140, 140, 150), 1, cv2.LINE_AA)
        elif is_speech_muted:
            cv2.putText(image, "[VOICE: MUTED]", (voice_x, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.44, cls.COLOR_ORANGE, 1, cv2.LINE_AA)
        else:
            cv2.putText(image, "[VOICE: ON]", (voice_x, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.44, cls.COLOR_GREEN, 1, cv2.LINE_AA)

        # FPS & Paused Indicator
        fps_text = f"FPS: {fps:.1f}"
        if is_paused:
            fps_text = "[PAUSED] " + fps_text
        cv2.putText(image, fps_text, (w_frame - 145, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.48, cls.COLOR_WHITE, 1, cv2.LINE_AA)

        # INTERACTIVE SESSION BUTTONS TOOLBAR (Under Top Header)
        cls.draw_session_buttons(image, session_active)

        # Bottom Controls Bar
        footer_overlay = image.copy()
        cv2.rectangle(footer_overlay, (0, h_frame - 36), (w_frame, h_frame), (12, 10, 20), -1)
        cv2.addWeighted(footer_overlay, 0.85, image, 0.15, 0, image)
        cv2.line(image, (0, h_frame - 36), (w_frame, h_frame - 36), cls.COLOR_PURPLE, 1, cv2.LINE_AA)

        help_text = "[ENTER] Start Session  [E] End Session  [SPACE] Pause  [C] Joke  [M] Voice  [V] Repeat  [S] Snap  [Q] Quit"
        cv2.putText(image, help_text, (20, h_frame - 12), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (200, 210, 230), 1, cv2.LINE_AA)

    @classmethod
    def draw_session_buttons(cls, image: np.ndarray, session_active: bool) -> None:
        """
        Renders interactive Start Session and End Session buttons with enabled/disabled states.
        """
        # 1. START SESSION BUTTON (x1=18, y1=54, x2=200, y2=92)
        sx1, sy1, sx2, sy2 = cls.BTN_START
        if not session_active:
            # Active/Clickable state: Green fill with dark text & glowing border
            cls.draw_rounded_rect(image, (sx1, sy1), (sx2, sy2), cls.COLOR_GREEN, radius=8, fill=True)
            cls.draw_rounded_rect(image, (sx1 - 1, sy1 - 1), (sx2 + 1, sy2 + 1), cls.COLOR_CYAN, radius=9, fill=False, thickness=2)
            cv2.putText(image, "START SESSION", (sx1 + 18, sy1 + 25), cv2.FONT_HERSHEY_DUPLEX, 0.52, cls.COLOR_BLACK, 2, cv2.LINE_AA)
        else:
            # Disabled state: Dimmed dark background with gray text
            cls.draw_rounded_rect(image, (sx1, sy1), (sx2, sy2), cls.COLOR_BTN_BG, radius=8, fill=True)
            cls.draw_rounded_rect(image, (sx1, sy1), (sx2, sy2), (50, 50, 65), radius=8, fill=False, thickness=1)
            cv2.putText(image, "START SESSION", (sx1 + 18, sy1 + 25), cv2.FONT_HERSHEY_SIMPLEX, 0.50, cls.COLOR_DISABLED, 1, cv2.LINE_AA)

        # 2. END SESSION BUTTON (x1=212, y1=54, x2=385, y2=92)
        ex1, ey1, ex2, ey2 = cls.BTN_END
        if session_active:
            # Active/Clickable state: Rose/Red fill with white text & glowing border
            cls.draw_rounded_rect(image, (ex1, ey1), (ex2, ey2), cls.COLOR_ROSE, radius=8, fill=True)
            cls.draw_rounded_rect(image, (ex1 - 1, ey1 - 1), (ex2 + 1, ey2 + 1), (120, 90, 255), radius=9, fill=False, thickness=2)
            cv2.putText(image, "END SESSION", (ex1 + 22, ey1 + 25), cv2.FONT_HERSHEY_DUPLEX, 0.52, cls.COLOR_WHITE, 2, cv2.LINE_AA)
        else:
            # Disabled state: Dimmed dark background with gray text
            cls.draw_rounded_rect(image, (ex1, ey1), (ex2, ey2), cls.COLOR_BTN_BG, radius=8, fill=True)
            cls.draw_rounded_rect(image, (ex1, ey1), (ex2, ey2), (50, 50, 65), radius=8, fill=False, thickness=1)
            cv2.putText(image, "END SESSION", (ex1 + 22, ey1 + 25), cv2.FONT_HERSHEY_SIMPLEX, 0.50, cls.COLOR_DISABLED, 1, cv2.LINE_AA)

    @classmethod
    def draw_session_inactive_card(cls, image: np.ndarray, time_val: float) -> None:
        """
        Renders a cinematic standby HUD card when the session is inactive.
        """
        h_frame, w_frame = image.shape[:2]
        card_w, card_h = 520, 130
        x1 = (w_frame - card_w) // 2
        y1 = (h_frame - card_h) // 2
        x2 = x1 + card_w
        y2 = y1 + card_h

        pulse = (math.sin(time_val * 3.0) + 1.0) / 2.0
        glow_color = (
            int(cls.COLOR_ORANGE[0] * (0.8 + 0.2 * pulse)),
            int(cls.COLOR_ORANGE[1] * (0.8 + 0.2 * pulse)),
            int(cls.COLOR_ORANGE[2] * (0.8 + 0.2 * pulse))
        )

        overlay = image.copy()
        cls.draw_rounded_rect(overlay, (x1, y1), (x2, y2), cls.COLOR_CARD_BG, radius=18, fill=True)
        cv2.addWeighted(overlay, 0.88, image, 0.12, 0, image)

        # Glowing border
        cls.draw_rounded_rect(image, (x1, y1), (x2, y2), glow_color, radius=18, fill=False, thickness=2)

        # Standby text inside
        cv2.putText(image, "SESSION INACTIVE", (x1 + 30, y1 + 36), cv2.FONT_HERSHEY_DUPLEX, 0.68, cls.COLOR_ORANGE, 2, cv2.LINE_AA)
        cv2.putText(image, "Click [START SESSION] button above or press ENTER", (x1 + 30, y1 + 70), cv2.FONT_HERSHEY_SIMPLEX, 0.50, cls.COLOR_WHITE, 1, cv2.LINE_AA)
        cv2.putText(image, "Face detection, tracking, comments & voice will activate.", (x1 + 30, y1 + 98), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (180, 180, 205), 1, cv2.LINE_AA)
