"""
AI Funny Face Commentator - Multi-Face Comment Engine
Manages face-specific comments, assigns max 4-5 unique comments per face appearance,
ensures unique assignments across multiple simultaneous faces, and manages session state.
All comments are 100% English only with emojis for visual display.
"""

import time
import random
import re
from typing import List, Dict, Optional, Tuple, Set


class FaceCommentRecord:
    """Tracks comments seen by a specific face during its appearance."""
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
    """
    Intelligent multi-face comment engine.
    Rules enforced:
      - Curated 30 English comments with visual emojis.
      - 100% English only (no Hindi, Urdu, or Hinglish).
      - Text-to-Speech speaks English words only without pronouncing emoji names.
      - Max 4-5 comments per face appearance.
      - Never continuously changes comments on every frame (2.8s dwell time).
      - Different comments assigned to different faces in the same session.
      - Locks to '👑 CERTIFIED LEGEND [MAX SWAG REACHED]' after 4-5 comments.
      - Full session reset support.
    """

    DEFAULT_GENERAL_COMMENTS: List[str] = [
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

    DEFAULT_SHOCK_COMMENTS: List[str] = [
        "😲 Mind Blown: Shocked Expression!",
        "😲 Astonishing Looks Detected!",
        "😲 Jaw Drop Moment: 100% Shock!",
        "😲 Out of This World Reaction!"
    ]

    DEFAULT_SMILE_COMMENTS: List[str] = [
        "😄 That's a Beautiful Smile!",
        "😄 Million Dollar Smile Confirmed!",
        "😄 1000 Watt Smile Detected!",
        "😄 Pure Joy and Brightness!"
    ]

    @staticmethod
    def clean_for_speech(text: str) -> str:
        """
        Strips emojis and non-ASCII symbols so text-to-speech speaks
        English words only without pronouncing emoji names.
        Example: '😎 Looking Good' -> 'Looking Good'
                 '🔥 So Beautiful' -> 'So Beautiful'
                 '⚡ Aura Level: 100' -> 'Aura Level: 100'
        """
        # Remove non-ASCII characters (emojis)
        cleaned = re.sub(r'[^\x00-\x7F]+', ' ', text)
        cleaned = ' '.join(cleaned.split()).strip()
        return cleaned if cleaned else text

    def __init__(self, rotation_interval: float = 2.8, max_comments_per_face: int = 5):
        self.rotation_interval = rotation_interval
        self.max_comments_per_face = max_comments_per_face

        self.general_comments = list(self.DEFAULT_GENERAL_COMMENTS)
        self.shock_comments = list(self.DEFAULT_SHOCK_COMMENTS)
        self.smile_comments = list(self.DEFAULT_SMILE_COMMENTS)

        # Mapping: {face_id: FaceCommentRecord}
        self.face_records: Dict[str, FaceCommentRecord] = {}

    def reset_session(self) -> None:
        """Resets all per-face comment tracking on session start/end."""
        self.face_records.clear()

    def get_active_assigned_comments(self, exclude_face_id: Optional[str] = None) -> Set[str]:
        """Returns set of comments currently shown on other active faces."""
        assigned = set()
        for fid, rec in self.face_records.items():
            if fid != exclude_face_id and rec.current_comment:
                assigned.add(rec.current_comment)
        return assigned

    def _pick_next_comment(self, record: FaceCommentRecord, reason: str = "SWAG") -> Tuple[str, str]:
        """
        Picks a new unique comment that this face hasn't seen yet,
        and is not currently assigned to another visible face.
        """
        if reason == "SHOCK":
            pool = self.shock_comments
            category = "SURPRISE!"
        elif reason == "SMILE":
            pool = self.smile_comments
            category = "SMILE LEGEND"
        else:
            pool = self.general_comments
            category = "SWAG ALERT"

        other_face_comments = self.get_active_assigned_comments(exclude_face_id=record.face_id)

        # Filter out comments this face has seen AND comments other faces are currently displaying
        available = [
            c for c in pool
            if c not in record.comments_seen and c not in other_face_comments
        ]

        # Fallback 1: comments this face hasn't seen
        if not available:
            available = [c for c in pool if c not in record.comments_seen]

        # Fallback 2: random from pool
        if not available:
            available = pool

        selected = random.choice(available)
        return selected, category

    def update_face(self, face_id: str, reaction: str = "neutral", force_next: bool = False) -> Tuple[str, str, bool, bool]:
        """
        Updates comment for a specific face.
        Returns: (comment, category, is_new_comment, is_max_reached)
        """
        now = time.time()

        # 1. New face appearance
        if face_id not in self.face_records:
            rec = FaceCommentRecord(face_id, max_comments=self.max_comments_per_face)
            c, cat = self._pick_next_comment(rec, reason="SWAG")
            rec.current_comment = c
            rec.current_category = cat
            rec.comments_seen.append(c)
            rec.comment_count = 1
            rec.last_update_time = now
            rec.last_reaction = reaction
            self.face_records[face_id] = rec
            return c, cat, True, False

        rec = self.face_records[face_id]

        # 2. Already reached max 4-5 comments
        if rec.is_max_reached:
            return rec.current_comment, "MAX SWAG REACHED", False, True

        # Check triggers: reaction change, forced next, or rotation interval
        is_reaction_trigger = (
            (reaction == "shock" and rec.last_reaction != "shock") or
            (reaction == "smile" and rec.last_reaction != "smile")
        )
        is_time_trigger = (now - rec.last_update_time >= self.rotation_interval)

        rec.last_reaction = reaction

        if force_next or is_reaction_trigger or is_time_trigger:
            # Check if this update reaches the cap
            if rec.comment_count >= rec.max_comments:
                rec.is_max_reached = True
                rec.current_comment = "👑 CERTIFIED LEGEND: MAX SWAG UNLOCKED!"
                rec.current_category = "MAX SWAG REACHED"
                rec.last_update_time = now
                return rec.current_comment, rec.current_category, True, True

            reason = "SHOCK" if reaction == "shock" else ("SMILE" if reaction == "smile" else "SWAG")
            c, cat = self._pick_next_comment(rec, reason=reason)
            rec.current_comment = c
            rec.current_category = cat
            rec.comments_seen.append(c)
            rec.comment_count += 1
            rec.last_update_time = now
            return c, cat, True, False

        # No change (within dwell interval)
        return rec.current_comment, rec.current_category, False, False

    def trigger_force_next_all(self) -> List[Tuple[str, str, str]]:
        """Forces the next comment for all currently visible faces (press 'C')."""
        results = []
        for fid in list(self.face_records.keys()):
            c, cat, is_new, is_max = self.update_face(fid, force_next=True)
            if is_new and not is_max:
                results.append((fid, c, cat))
        return results
