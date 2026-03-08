"""
RIQE Encoders
─────────────
TextEncoder:       wraps sentence-transformers all-MiniLM-L6-v2
StructuredEncoder: converts a UserProfile into a flat numeric vector
"""

from __future__ import annotations

import functools
from typing import TYPE_CHECKING

import numpy as np
from sentence_transformers import SentenceTransformer

from riqe.config import (
    SENTENCE_MODEL_NAME,
    RIQE_MODEL_PATH,
    FIELD_OF_STUDY_VOCAB,
    NUM_FIELDS,
    MAX_SKILLS,
    LEARNING_HISTORY_DIM,
    STRUCTURED_DIM,
)

if TYPE_CHECKING:
    from riqe.api.schemas import UserProfileSchema


# ═══════════════════════════════════════════════════════════════════════
# Text Encoder
# ═══════════════════════════════════════════════════════════════════════

class TextEncoder:
    """
    Wraps sentence-transformers ``all-MiniLM-L6-v2`` for 384-dim embeddings.
    Encodings are cached with ``functools.lru_cache``.
    If RIQE_MODEL_PATH is set, loads from that directory with local_files_only=True
    to avoid download and "loading weights 0%" errors when offline or blocked.
    """

    def __init__(self) -> None:
        model_name_or_path = SENTENCE_MODEL_NAME
        local_files_only = False
        if RIQE_MODEL_PATH:
            model_name_or_path = RIQE_MODEL_PATH
            local_files_only = True
        try:
            self._model = SentenceTransformer(
                model_name_or_path,
                local_files_only=local_files_only,
            )
        except Exception as e:
            if RIQE_MODEL_PATH:
                raise RuntimeError(
                    f"Failed to load embedding model from RIQE_MODEL_PATH={RIQE_MODEL_PATH}. "
                    f"Ensure the directory contains a valid sentence-transformers model. Error: {e}"
                ) from e
            raise RuntimeError(
                "Failed to load embedding model (often seen as 'loading weights 0%' then error). "
                "Ensure you have internet access and can reach huggingface.co, or pre-download the model and set "
                "RIQE_MODEL_PATH to the model directory. Example: python -c \"from sentence_transformers import "
                "SentenceTransformer; m = SentenceTransformer('all-MiniLM-L6-v2'); m.save('/path/to/model')\" "
                f"Then set RIQE_MODEL_PATH=/path/to/model. Original error: {e}"
            ) from e

    # lru_cache requires hashable args — we wrap the string through a helper
    @functools.lru_cache(maxsize=4096)
    def encode(self, text: str) -> np.ndarray:
        """Encode a single text string → 384-dim numpy vector."""
        vec: np.ndarray = self._model.encode(text, convert_to_numpy=True)
        return vec.astype(np.float32)

    def encode_batch(self, texts: list[str]) -> np.ndarray:
        """Encode a list of texts → (N, 384) numpy array."""
        vecs: np.ndarray = self._model.encode(texts, convert_to_numpy=True)
        return vecs.astype(np.float32)


# ═══════════════════════════════════════════════════════════════════════
# Structured Encoder
# ═══════════════════════════════════════════════════════════════════════

class StructuredEncoder:
    """
    Encodes non-text profile attributes into a fixed-length flat vector.

    Output layout (STRUCTURED_DIM = {MAX_SKILLS} + {NUM_FIELDS} + 1 + {LEARNING_HISTORY_DIM}):
      ┌────────────────────────────────────────────────────────────────┐
      │ z-scored skill values (padded/truncated to MAX_SKILLS)        │
      │ one-hot field_of_study (NUM_FIELDS)                           │
      │ log-scaled timeframe_weeks (1)                                │
      │ mean-pooled learning history stats (LEARNING_HISTORY_DIM)     │
      └────────────────────────────────────────────────────────────────┘
    """

    @staticmethod
    def encode_profile(
        skill_scores: dict[str, float],
        field_of_study: str,
        timeframe_weeks: int,
        learning_history: list[dict] | None = None,
    ) -> np.ndarray:
        """
        Convert structured profile fields to a flat numpy vector.

        Parameters
        ----------
        skill_scores : dict[str, float]
            e.g. {"python": 0.7, "statistics": 0.3}
        field_of_study : str
            Must be one of ``FIELD_OF_STUDY_VOCAB`` or will map to "other".
        timeframe_weeks : int
            Target learning timeframe in weeks.
        learning_history : list[dict] | None
            Each dict has keys: completion_rate, quiz_score,
            time_spent_minutes, revisit_count.

        Returns
        -------
        np.ndarray (STRUCTURED_DIM,)
        """
        parts: list[np.ndarray] = []

        # ── 1. skill scores → z-score, pad/truncate to MAX_SKILLS ────
        raw_skills = list(skill_scores.values()) if skill_scores else [0.0]
        arr = np.array(raw_skills, dtype=np.float32)
        mean, std = arr.mean(), arr.std() + 1e-8
        z_scored = (arr - mean) / std
        # pad / truncate
        padded = np.zeros(MAX_SKILLS, dtype=np.float32)
        n = min(len(z_scored), MAX_SKILLS)
        padded[:n] = z_scored[:n]
        parts.append(padded)

        # ── 2. one-hot field_of_study ─────────────────────────────────
        one_hot = np.zeros(NUM_FIELDS, dtype=np.float32)
        if field_of_study in FIELD_OF_STUDY_VOCAB:
            idx = FIELD_OF_STUDY_VOCAB.index(field_of_study)
        else:
            idx = FIELD_OF_STUDY_VOCAB.index("other")
        one_hot[idx] = 1.0
        parts.append(one_hot)

        # ── 3. log-scaled timeframe ───────────────────────────────────
        log_tf = np.array([np.log1p(float(timeframe_weeks))], dtype=np.float32)
        parts.append(log_tf)

        # ── 4. mean-pooled learning history stats ─────────────────────
        if learning_history and len(learning_history) > 0:
            completions = [e.get("completion_rate", 0.0) for e in learning_history]
            quizzes = [e.get("quiz_score", 0.0) for e in learning_history]
            times = [e.get("time_spent_minutes", 0) for e in learning_history]
            revisits = [e.get("revisit_count", 0) for e in learning_history]
            stats = np.array(
                [
                    np.mean(completions),
                    np.mean(quizzes),
                    np.mean(times),
                    np.sum(revisits),
                ],
                dtype=np.float32,
            )
        else:
            stats = np.zeros(LEARNING_HISTORY_DIM, dtype=np.float32)
        parts.append(stats)

        vec = np.concatenate(parts)
        assert vec.shape == (STRUCTURED_DIM,), f"Expected {STRUCTURED_DIM}, got {vec.shape}"
        return vec
