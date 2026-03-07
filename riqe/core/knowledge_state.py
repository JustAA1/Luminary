"""
RIQE Knowledge-State Manager
─────────────────────────────
Manages per-user knowledge vectors and topic lists.
Provides initialization, incremental update, and cross-roadmap transfer.
"""

from __future__ import annotations

import uuid
from copy import deepcopy
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Optional

import numpy as np
import torch

from riqe.config import (
    USER_EMBED_DIM,
    EMA_ALPHA,
    COMPLETION_THRESHOLD,
    WEAK_TOPIC_THRESHOLD,
    REINFORCEMENT_WEIGHT,
    TEXT_EMBED_DIM,
)
from riqe.models.encoders import TextEncoder, StructuredEncoder
from riqe.models.models import UserProfileMLP
from riqe.db import db


# ═══════════════════════════════════════════════════════════════════════
# Dataclasses (internal representations)
# ═══════════════════════════════════════════════════════════════════════

@dataclass
class RIQESignal:
    """A single classified signal extracted from incoming text."""
    text: str
    timestamp: datetime
    topic: str
    strength: float
    is_new_info: bool
    trend: str                     # "rising" | "stable" | "fading"
    reliability_score: float
    signal_type: str = "new_info"  # new_info | reinforcement | contradiction


@dataclass
class RoadmapSession:
    """Tracks one session of roadmap usage."""
    session_id: str
    roadmap_id: str
    signals_received: list[RIQESignal] = field(default_factory=list)
    roadmap_versions: list[Any] = field(default_factory=list)  # list[Roadmap]
    final_quality_delta: float = 0.0


@dataclass
class KnowledgeState:
    """Full mutable state for a single user."""
    user_id: str
    user_vector: np.ndarray                         # (128,)
    completed_topics: list[str] = field(default_factory=list)
    weak_topics: list[str] = field(default_factory=list)
    strong_signals: list[RIQESignal] = field(default_factory=list)
    session_history: list[RoadmapSession] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        """Serialize for Supabase storage."""
        return {
            "user_id": self.user_id,
            "user_vector": self.user_vector.tolist(),
            "completed_topics": self.completed_topics,
            "weak_topics": self.weak_topics,
            "strong_signals": [
                {
                    "text": s.text,
                    "timestamp": s.timestamp.isoformat(),
                    "topic": s.topic,
                    "strength": s.strength,
                    "is_new_info": s.is_new_info,
                    "trend": s.trend,
                    "reliability_score": s.reliability_score,
                    "signal_type": s.signal_type,
                }
                for s in self.strong_signals
            ],
        }

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> "KnowledgeState":
        """Deserialize from Supabase row."""
        signals = [
            RIQESignal(
                text=s["text"],
                timestamp=datetime.fromisoformat(s["timestamp"]),
                topic=s["topic"],
                strength=s["strength"],
                is_new_info=s["is_new_info"],
                trend=s["trend"],
                reliability_score=s["reliability_score"],
                signal_type=s.get("signal_type", "new_info"),
            )
            for s in (d.get("strong_signals") or [])
        ]
        return cls(
            user_id=d["user_id"],
            user_vector=np.array(d["user_vector"], dtype=np.float32),
            completed_topics=d.get("completed_topics", []),
            weak_topics=d.get("weak_topics", []),
            strong_signals=signals,
        )


# ═══════════════════════════════════════════════════════════════════════
# Knowledge-State Manager
# ═══════════════════════════════════════════════════════════════════════

class KnowledgeStateManager:
    """
    Lifecycle manager for a user's :class:`KnowledgeState`.

    Methods
    -------
    initialize   – create initial state from a UserProfile
    update_from_signal – incorporate a new RIQESignal
    transfer_context   – carry state to a new roadmap
    """

    def __init__(self, text_encoder: TextEncoder, user_mlp: UserProfileMLP) -> None:
        self.text_encoder = text_encoder
        self.user_mlp = user_mlp
        self.user_mlp.eval()

    # ── initialize ────────────────────────────────────────────────────

    def initialize(
        self,
        user_id: str,
        resume_text: str,
        skill_scores: dict[str, float],
        interests: list[str],
        field_of_study: str,
        timeframe_weeks: int,
        learning_history: list[dict] | None = None,
    ) -> KnowledgeState:
        """
        Build an initial KnowledgeState from raw profile fields.

        1. Encode resume + interests via TextEncoder
        2. Encode structured fields via StructuredEncoder
        3. Concatenate → run UserProfileMLP → 128-dim user_vector
        4. Derive completed_topics / weak_topics from learning_history
        """
        # Text embeddings
        resume_vec = self.text_encoder.encode(resume_text)
        interests_vec = self.text_encoder.encode(" ".join(interests))

        # Structured vector
        struct_vec = StructuredEncoder.encode_profile(
            skill_scores=skill_scores,
            field_of_study=field_of_study,
            timeframe_weeks=timeframe_weeks,
            learning_history=learning_history,
        )

        # Concatenate → MLP
        concat = np.concatenate([resume_vec, interests_vec, struct_vec])
        with torch.no_grad():
            inp = torch.tensor(concat, dtype=torch.float32).unsqueeze(0)
            user_vector: np.ndarray = self.user_mlp(inp).squeeze(0).numpy()

        # Derive topic lists from learning history
        completed: list[str] = []
        weak: list[str] = []
        if learning_history:
            for evt in learning_history:
                tid = evt.get("topic_id", "")
                if evt.get("completion_rate", 0.0) > COMPLETION_THRESHOLD:
                    completed.append(tid)
                if evt.get("quiz_score", 1.0) < WEAK_TOPIC_THRESHOLD:
                    weak.append(tid)

        return KnowledgeState(
            user_id=user_id,
            user_vector=user_vector,
            completed_topics=completed,
            weak_topics=weak,
        )

    # ── update from signal ────────────────────────────────────────────

    def update_from_signal(
        self,
        state: KnowledgeState,
        signal: RIQESignal,
    ) -> KnowledgeState:
        """
        Incorporate a new signal into the knowledge state.

        - new_info       → add topic to strong_signals
        - reinforcement  → boost existing topic weight
        - contradiction  → flag topic for re-ordering
        - Always: EMA-update user_vector
        """
        state = deepcopy(state)

        if signal.signal_type == "new_info" or signal.is_new_info:
            state.strong_signals.append(signal)
        elif signal.signal_type == "reinforcement":
            # Boost existing signal strength for the same topic
            for existing in state.strong_signals:
                if existing.topic == signal.topic:
                    existing.strength = min(
                        1.0,
                        existing.strength + REINFORCEMENT_WEIGHT * signal.strength,
                    )
        elif signal.signal_type == "contradiction":
            # Flag topic as weak (will be pushed later in roadmap)
            if signal.topic not in state.weak_topics:
                state.weak_topics.append(signal.topic)

        # EMA update of user_vector with signal text embedding
        signal_embed = self.text_encoder.encode(signal.text)
        # Project 384-dim signal to 128-dim via mean-folding
        signal_128 = self._project_to_user_dim(signal_embed)
        state.user_vector = (
            EMA_ALPHA * state.user_vector + (1 - EMA_ALPHA) * signal_128
        )

        return state

    # ── transfer context ──────────────────────────────────────────────

    def transfer_context(
        self,
        old_state: KnowledgeState,
        new_roadmap_id: str,
    ) -> KnowledgeState:
        """
        Carry knowledge state to a brand-new roadmap session.

        - Copies: completed_topics, weak_topics, user_vector, strong_signals
        - Boosts weights for topics NOT in completed_topics
        - Increases weights for weak_topics (surface them early)
        """
        new_state = KnowledgeState(
            user_id=old_state.user_id,
            user_vector=old_state.user_vector.copy(),
            completed_topics=list(old_state.completed_topics),
            weak_topics=list(old_state.weak_topics),
            strong_signals=list(old_state.strong_signals),
            session_history=list(old_state.session_history),
        )

        # Boost strong_signals for topics that are NOT completed
        for sig in new_state.strong_signals:
            if sig.topic not in new_state.completed_topics:
                sig.strength = min(1.0, sig.strength * 1.2)  # 20 % boost

        # Increase strength for weak topics (they need attention)
        for sig in new_state.strong_signals:
            if sig.topic in new_state.weak_topics:
                sig.strength = min(1.0, sig.strength * 1.3)  # 30 % boost

        # Start a new session record
        new_state.session_history.append(
            RoadmapSession(
                session_id=str(uuid.uuid4()),
                roadmap_id=new_roadmap_id,
            )
        )

        return new_state

    # ── helpers ────────────────────────────────────────────────────────

    @staticmethod
    def _project_to_user_dim(vec_384: np.ndarray) -> np.ndarray:
        """
        Project a 384-dim text embedding down to 128-dim by reshaping
        into (3, 128) and mean-pooling along axis 0.
        """
        return vec_384.reshape(3, 128).mean(axis=0)
