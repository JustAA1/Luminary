"""
Tests for RIQE Signal Processor
────────────────────────────────
Validates signal classification, buffer management, temporal decay,
and reliability computation.
"""

from __future__ import annotations

from datetime import datetime

import numpy as np
import pytest

from riqe.config import SIGNAL_BUFFER_SIZE, TEXT_EMBED_DIM
from riqe.models.encoders import TextEncoder
from riqe.models.models import RIQESignalClassifier, TrendGRU
from riqe.core.signal_processor import SignalProcessor


@pytest.fixture(scope="module")
def processor() -> SignalProcessor:
    """Module-scoped signal processor fixture."""
    te = TextEncoder()
    sc = RIQESignalClassifier()
    gru = TrendGRU()
    topic_ids = [f"topic_{i}" for i in range(50)]
    return SignalProcessor(te, sc, gru, topic_id_list=topic_ids)


class TestSignalProcessor:
    def test_process_returns_signal(self, processor: SignalProcessor) -> None:
        sig = processor.process("Machine learning is changing the world", datetime.utcnow())
        assert sig.text == "Machine learning is changing the world"
        assert isinstance(sig.topic, str)
        assert 0.0 <= sig.strength <= 1.0
        assert sig.trend in ("rising", "stable", "fading")
        assert sig.signal_type in ("new_info", "reinforcement", "contradiction")
        assert isinstance(sig.reliability_score, float)

    def test_buffer_fills(self, processor: SignalProcessor) -> None:
        """Process enough signals to fill the buffer."""
        # Clear buffer
        processor.buffer.clear()
        processor._feature_buffer.clear()

        for i in range(SIGNAL_BUFFER_SIZE + 5):
            processor.process(f"Signal number {i}", datetime.utcnow())

        assert len(processor.buffer) == SIGNAL_BUFFER_SIZE
        assert len(processor._feature_buffer) == SIGNAL_BUFFER_SIZE

    def test_reliability_in_range(self, processor: SignalProcessor) -> None:
        processor.buffer.clear()
        processor._feature_buffer.clear()

        sig = processor.process("test signal for reliability", datetime.utcnow())
        assert sig.reliability_score >= 0.0

    def test_temporal_decay_reduces_strength(self) -> None:
        """Temporal decay should reduce strength for non-zero timestamps."""
        strength = 0.8
        # Midday timestamp
        ts = datetime(2025, 1, 1, 12, 0, 0)
        decayed = SignalProcessor._apply_temporal_decay(strength, ts)
        assert decayed < strength
        assert decayed > 0.0

    def test_feature_vector_shape(self) -> None:
        """Project 384 → 64 dims."""
        from riqe.config import SIGNAL_FEATURE_DIM
        vec_384 = np.random.randn(TEXT_EMBED_DIM).astype(np.float32)
        feat = SignalProcessor._to_feature_vector(vec_384, 0.5)
        assert feat.shape == (SIGNAL_FEATURE_DIM,)

    def test_validate_signal_reliability(self, processor: SignalProcessor) -> None:
        """With no versions, reliability delta should be 0."""
        delta = processor.validate_signal_reliability([])
        assert delta == 0.0

    def test_validate_with_two_versions(self, processor: SignalProcessor) -> None:
        """Quality improvement measurable with two roadmap versions."""

        class MockRoadmap:
            def __init__(self, q: float) -> None:
                self.quality_score = q

        v1 = MockRoadmap(0.3)
        v2 = MockRoadmap(0.7)
        delta = processor.validate_signal_reliability([v1, v2])
        assert abs(delta - 0.4) < 1e-6
