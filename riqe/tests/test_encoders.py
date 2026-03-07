"""
Tests for RIQE Encoders
───────────────────────
Validates TextEncoder and StructuredEncoder output shapes,
determinism, and caching.
"""

from __future__ import annotations

import numpy as np
import pytest

from riqe.config import TEXT_EMBED_DIM, STRUCTURED_DIM
from riqe.models.encoders import TextEncoder, StructuredEncoder


# ═══════════════════════════════════════════════════════════════════════
# TextEncoder
# ═══════════════════════════════════════════════════════════════════════

@pytest.fixture(scope="module")
def text_encoder() -> TextEncoder:
    """Module-scoped fixture — loads model once."""
    return TextEncoder()


class TestTextEncoder:
    def test_encode_shape(self, text_encoder: TextEncoder) -> None:
        vec = text_encoder.encode("Introduction to machine learning")
        assert vec.shape == (TEXT_EMBED_DIM,)
        assert vec.dtype == np.float32

    def test_encode_batch_shape(self, text_encoder: TextEncoder) -> None:
        texts = ["Hello world", "Deep learning basics", "PyTorch tutorial"]
        vecs = text_encoder.encode_batch(texts)
        assert vecs.shape == (3, TEXT_EMBED_DIM)
        assert vecs.dtype == np.float32

    def test_encode_determinism(self, text_encoder: TextEncoder) -> None:
        """Same input → same output (also tests cache)."""
        v1 = text_encoder.encode("determinism test")
        v2 = text_encoder.encode("determinism test")
        np.testing.assert_array_equal(v1, v2)

    def test_encode_different_texts(self, text_encoder: TextEncoder) -> None:
        """Different texts produce different embeddings."""
        v1 = text_encoder.encode("cats")
        v2 = text_encoder.encode("quantum physics")
        assert not np.allclose(v1, v2, atol=1e-3)

    def test_encode_empty_string(self, text_encoder: TextEncoder) -> None:
        vec = text_encoder.encode("")
        assert vec.shape == (TEXT_EMBED_DIM,)


# ═══════════════════════════════════════════════════════════════════════
# StructuredEncoder
# ═══════════════════════════════════════════════════════════════════════

class TestStructuredEncoder:
    def test_encode_profile_shape(self) -> None:
        vec = StructuredEncoder.encode_profile(
            skill_scores={"python": 0.7, "statistics": 0.3},
            field_of_study="computer_science",
            timeframe_weeks=12,
        )
        assert vec.shape == (STRUCTURED_DIM,)
        assert vec.dtype == np.float32

    def test_encode_profile_with_history(self) -> None:
        history = [
            {
                "topic_id": "t1",
                "completion_rate": 0.9,
                "quiz_score": 0.85,
                "time_spent_minutes": 120,
                "revisit_count": 2,
            },
            {
                "topic_id": "t2",
                "completion_rate": 0.5,
                "quiz_score": 0.4,
                "time_spent_minutes": 60,
                "revisit_count": 0,
            },
        ]
        vec = StructuredEncoder.encode_profile(
            skill_scores={"ml": 0.6},
            field_of_study="data_science",
            timeframe_weeks=8,
            learning_history=history,
        )
        assert vec.shape == (STRUCTURED_DIM,)

    def test_unknown_field_defaults_to_other(self) -> None:
        vec = StructuredEncoder.encode_profile(
            skill_scores={},
            field_of_study="underwater_basket_weaving",
            timeframe_weeks=4,
        )
        assert vec.shape == (STRUCTURED_DIM,)
        # "other" is index 19 in FIELD_OF_STUDY_VOCAB
        from riqe.config import MAX_SKILLS, FIELD_OF_STUDY_VOCAB
        other_idx = FIELD_OF_STUDY_VOCAB.index("other")
        one_hot_start = MAX_SKILLS
        assert vec[one_hot_start + other_idx] == 1.0

    def test_empty_skills(self) -> None:
        """Empty skill_scores should still produce valid output."""
        vec = StructuredEncoder.encode_profile(
            skill_scores={},
            field_of_study="mathematics",
            timeframe_weeks=1,
        )
        assert vec.shape == (STRUCTURED_DIM,)

    def test_many_skills_truncated(self) -> None:
        """More skills than MAX_SKILLS should be truncated, not error."""
        from riqe.config import MAX_SKILLS
        skills = {f"skill_{i}": float(i) / 100 for i in range(50)}
        vec = StructuredEncoder.encode_profile(
            skill_scores=skills,
            field_of_study="computer_science",
            timeframe_weeks=20,
        )
        assert vec.shape == (STRUCTURED_DIM,)
