"""
RIQE Signal Processor
─────────────────────
Converts raw text into classified, trend-annotated RIQESignals.
Maintains a rolling buffer and computes reliability scores.
"""

from __future__ import annotations

import math
from collections import deque
from datetime import datetime
from typing import Optional

import json
import numpy as np
import torch

from riqe.config import (
    SIGNAL_BUFFER_SIZE,
    TEMPORAL_DECAY_LAMBDA,
    RELIABILITY_VARIANCE_WINDOW,
    SIGNAL_FEATURE_DIM,
    N_TOPICS,
    TOPICS_FILE,
)
from riqe.models.encoders import TextEncoder
from riqe.models.models import RIQESignalClassifier, TrendGRU
from riqe.core.knowledge_state import RIQESignal


class SignalProcessor:
    """
    Stateful processor that turns text into :class:`RIQESignal` instances.

    Maintains a rolling buffer of the last ``SIGNAL_BUFFER_SIZE`` signals
    and feeds the buffer into :class:`TrendGRU` for trend classification.
    """

    def __init__(
        self,
        text_encoder: TextEncoder,
        signal_classifier: RIQESignalClassifier,
        trend_gru: TrendGRU,
        topic_id_list: list[str] | None = None,
    ) -> None:
        self.text_encoder = text_encoder
        self.signal_classifier = signal_classifier
        self.trend_gru = trend_gru

        self.signal_classifier.eval()
        self.trend_gru.eval()

        self.buffer: deque[RIQESignal] = deque(maxlen=SIGNAL_BUFFER_SIZE)
        self._feature_buffer: deque[np.ndarray] = deque(maxlen=SIGNAL_BUFFER_SIZE)

        # Build topic-id lookup
        if topic_id_list is not None:
            self.topic_ids = topic_id_list
        else:
            self.topic_ids = self._load_topic_ids()

    # ── public: process ───────────────────────────────────────────────

    def process(self, text: str, timestamp: datetime) -> RIQESignal:
        """
        Full signal-processing pipeline:

        1. Encode text (384-dim)
        2. Classify → topic, strength, signal_type
        3. Append to rolling buffer
        4. Run TrendGRU → trend label
        5. Apply temporal decay to strength
        6. Compute reliability score
        7. Return ``RIQESignal``
        """
        # 1. encode
        text_vec = self.text_encoder.encode(text)
        text_tensor = torch.tensor(text_vec, dtype=torch.float32).unsqueeze(0)

        # 2. classify
        with torch.no_grad():
            topic_logits, strength_raw, type_logits = self.signal_classifier(
                text_tensor
            )

        topic_idx = int(topic_logits.argmax(dim=-1).item())
        topic_id = (
            self.topic_ids[topic_idx]
            if topic_idx < len(self.topic_ids)
            else f"topic_{topic_idx}"
        )

        strength = float(strength_raw.item())

        type_idx = int(type_logits.argmax(dim=-1).item())
        signal_type = RIQESignalClassifier.SIGNAL_TYPE_LABELS[type_idx]
        is_new_info = signal_type == "new_info"

        # 3. buffer — store a 64-dim feature for the GRU
        feature = self._to_feature_vector(text_vec, strength)
        self._feature_buffer.append(feature)

        # 4. trend
        trend_label, _trend_vec = self._run_trend_gru()

        # 5. temporal decay
        strength = self._apply_temporal_decay(strength, timestamp)

        # 6. reliability
        reliability = self._compute_reliability(strength)

        signal = RIQESignal(
            text=text,
            timestamp=timestamp,
            topic=topic_id,
            strength=strength,
            is_new_info=is_new_info,
            trend=trend_label,
            reliability_score=reliability,
            signal_type=signal_type,
        )
        self.buffer.append(signal)
        return signal

    # ── public: validate_signal_reliability ────────────────────────────

    def validate_signal_reliability(
        self,
        roadmap_versions: list,  # list[Roadmap]
    ) -> float:
        """
        Compare quality_score at v1 vs vN → delta as reliability proof.
        """
        if len(roadmap_versions) < 2:
            return 0.0
        v1_quality = getattr(roadmap_versions[0], "quality_score", 0.0)
        vn_quality = getattr(roadmap_versions[-1], "quality_score", 0.0)
        return float(vn_quality - v1_quality)

    # ── internals ─────────────────────────────────────────────────────

    @staticmethod
    def _to_feature_vector(text_vec: np.ndarray, strength: float) -> np.ndarray:
        """
        Project 384-dim text vector to 64-dim and scale by strength.
        Reshapes (384,) → (6, 64) and mean-pools → (64,).
        """
        proj = text_vec.reshape(6, SIGNAL_FEATURE_DIM).mean(axis=0)
        return proj * strength

    def _run_trend_gru(self) -> tuple[str, np.ndarray]:
        """Run TrendGRU over the feature buffer and return (label, vector)."""
        if len(self._feature_buffer) == 0:
            return "stable", np.zeros(SIGNAL_FEATURE_DIM, dtype=np.float32)

        seq = np.stack(list(self._feature_buffer), axis=0)  # (seq_len, 64)
        seq_tensor = torch.tensor(seq, dtype=torch.float32).unsqueeze(0)  # (1, seq, 64)
        lengths = torch.tensor([seq.shape[0]], dtype=torch.long)

        with torch.no_grad():
            logits, hidden = self.trend_gru(seq_tensor, lengths)

        trend_idx = int(logits.argmax(dim=-1).item())
        trend_label = TrendGRU.TREND_LABELS[trend_idx]
        trend_vector = hidden.squeeze(0).numpy()
        return trend_label, trend_vector

    @staticmethod
    def _apply_temporal_decay(strength: float, timestamp: datetime) -> float:
        """
        Apply exponential temporal decay:
        ``strength *= exp(-λ · seconds_since_epoch_offset)``

        We use seconds-since-midnight as a simple proxy.
        """
        seconds = (
            timestamp.hour * 3600 + timestamp.minute * 60 + timestamp.second
        )
        decay = math.exp(-TEMPORAL_DECAY_LAMBDA * seconds)
        return strength * decay

    def _compute_reliability(self, current_strength: float) -> float:
        """
        ``reliability = strength × (1 − variance_of_last_N_strengths)``
        """
        recent_strengths = [
            s.strength for s in list(self.buffer)[-RELIABILITY_VARIANCE_WINDOW:]
        ]
        recent_strengths.append(current_strength)

        if len(recent_strengths) < 2:
            variance = 0.0
        else:
            variance = float(np.var(recent_strengths))

        return current_strength * max(0.0, 1.0 - variance)

    @staticmethod
    def _load_topic_ids() -> list[str]:
        """Load topic IDs from ``topics.json``."""
        try:
            with open(str(TOPICS_FILE), "r", encoding="utf-8") as f:
                topics = json.load(f)
            return [t["topic_id"] for t in topics]
        except FileNotFoundError:
            return [f"topic_{i}" for i in range(N_TOPICS)]
