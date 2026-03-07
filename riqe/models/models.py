"""
RIQE PyTorch Models
───────────────────
UserProfileMLP:       user profile → 128-dim embedding (triplet loss)
RIQESignalClassifier: text embedding → topic + strength + signal_type
TrendGRU:             signal sequence → trend label + trend vector
"""

from __future__ import annotations

from pathlib import Path
from typing import Optional

import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.nn.utils.rnn import pack_padded_sequence, pad_packed_sequence

from riqe.config import (
    PROFILE_INPUT_DIM,
    MLP_HIDDEN_1,
    MLP_HIDDEN_2,
    MLP_DROPOUT,
    USER_EMBED_DIM,
    TEXT_EMBED_DIM,
    SIGNAL_TRUNK_DIM,
    SIGNAL_DROPOUT,
    N_TOPICS,
    NUM_SIGNAL_TYPES,
    SIGNAL_FEATURE_DIM,
    GRU_HIDDEN_DIM,
    GRU_NUM_LAYERS,
    NUM_TREND_CLASSES,
    LOSS_WEIGHT_TOPIC,
    LOSS_WEIGHT_STRENGTH,
    LOSS_WEIGHT_SIGNAL_TYPE,
    TRIPLET_MARGIN,
    CHECKPOINTS_DIR,
)


# ═══════════════════════════════════════════════════════════════════════
# Helper: load checkpoint if it exists
# ═══════════════════════════════════════════════════════════════════════

def _maybe_load_checkpoint(model: nn.Module, name: str) -> nn.Module:
    """Load saved weights from ``CHECKPOINTS_DIR/<name>.pt`` if the file exists."""
    ckpt_path = CHECKPOINTS_DIR / f"{name}.pt"
    if ckpt_path.is_file():
        state = torch.load(ckpt_path, map_location="cpu", weights_only=True)
        model.load_state_dict(state)
    return model


# ═══════════════════════════════════════════════════════════════════════
# 1. UserProfileMLP
# ═══════════════════════════════════════════════════════════════════════

class UserProfileMLP(nn.Module):
    """
    Maps a concatenated profile vector (resume_embed ⊕ interests_embed ⊕
    structured_vec) to a 128-dim user embedding.

    Architecture
    ────────────
    Linear(PROFILE_INPUT_DIM, 256) → ReLU → Dropout(0.2)
    → Linear(256, 128) → ReLU → Linear(128, 128)

    Training uses **triplet loss**: anchor = user, positive = completed-
    topic embedding, negative = random-topic embedding.
    """

    def __init__(self, input_dim: int = PROFILE_INPUT_DIM) -> None:
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(input_dim, MLP_HIDDEN_1),
            nn.ReLU(),
            nn.Dropout(MLP_DROPOUT),
            nn.Linear(MLP_HIDDEN_1, MLP_HIDDEN_2),
            nn.ReLU(),
            nn.Linear(MLP_HIDDEN_2, USER_EMBED_DIM),
        )
        _maybe_load_checkpoint(self, "user_profile_mlp")

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Parameters
        ----------
        x : Tensor of shape ``(batch, PROFILE_INPUT_DIM)``

        Returns
        -------
        Tensor of shape ``(batch, 128)``
        """
        return self.net(x)

    @staticmethod
    def triplet_loss(
        anchor: torch.Tensor,
        positive: torch.Tensor,
        negative: torch.Tensor,
    ) -> torch.Tensor:
        """Compute the triplet-margin loss."""
        return F.triplet_margin_loss(
            anchor, positive, negative, margin=TRIPLET_MARGIN
        )


# ═══════════════════════════════════════════════════════════════════════
# 2. RIQESignalClassifier
# ═══════════════════════════════════════════════════════════════════════

class RIQESignalClassifier(nn.Module):
    """
    Multi-head classifier for incoming text signals.

    Shared trunk
    ────────────
    Linear(384, 128) → ReLU → Dropout(0.3)

    Heads
    ─────
    1. topic      : Linear(128, N_TOPICS) → Softmax
    2. strength   : Linear(128, 1)        → Sigmoid
    3. signal_type: Linear(128, 3)        → Softmax  (new_info / reinforcement / contradiction)

    Composite loss = 0.4 · CE(topic) + 0.4 · BCE(strength) + 0.2 · CE(signal_type)
    """

    SIGNAL_TYPE_LABELS: list[str] = ["new_info", "reinforcement", "contradiction"]

    def __init__(self, n_topics: int = N_TOPICS) -> None:
        super().__init__()
        self.n_topics = n_topics

        # shared trunk
        self.trunk = nn.Sequential(
            nn.Linear(TEXT_EMBED_DIM, SIGNAL_TRUNK_DIM),
            nn.ReLU(),
            nn.Dropout(SIGNAL_DROPOUT),
        )

        # heads
        self.head_topic = nn.Linear(SIGNAL_TRUNK_DIM, n_topics)
        self.head_strength = nn.Linear(SIGNAL_TRUNK_DIM, 1)
        self.head_signal_type = nn.Linear(SIGNAL_TRUNK_DIM, NUM_SIGNAL_TYPES)

        _maybe_load_checkpoint(self, "signal_classifier")

    def forward(
        self, x: torch.Tensor
    ) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        """
        Parameters
        ----------
        x : Tensor of shape ``(batch, 384)``

        Returns
        -------
        topic_logits  : (batch, N_TOPICS)
        strength      : (batch, 1)   in [0, 1]
        type_logits   : (batch, 3)
        """
        h = self.trunk(x)
        topic_logits = self.head_topic(h)
        strength = torch.sigmoid(self.head_strength(h))
        type_logits = self.head_signal_type(h)
        return topic_logits, strength, type_logits

    @staticmethod
    def composite_loss(
        topic_logits: torch.Tensor,
        topic_targets: torch.Tensor,
        strength_pred: torch.Tensor,
        strength_targets: torch.Tensor,
        type_logits: torch.Tensor,
        type_targets: torch.Tensor,
    ) -> torch.Tensor:
        """
        Weighted multi-task loss.

        0.4 · CrossEntropy(topic) + 0.4 · BCE(strength) + 0.2 · CrossEntropy(type)
        """
        ce_topic = F.cross_entropy(topic_logits, topic_targets)
        bce_strength = F.binary_cross_entropy(
            strength_pred.squeeze(-1), strength_targets
        )
        ce_type = F.cross_entropy(type_logits, type_targets)

        return (
            LOSS_WEIGHT_TOPIC * ce_topic
            + LOSS_WEIGHT_STRENGTH * bce_strength
            + LOSS_WEIGHT_SIGNAL_TYPE * ce_type
        )


# ═══════════════════════════════════════════════════════════════════════
# 3. TrendGRU
# ═══════════════════════════════════════════════════════════════════════

class TrendGRU(nn.Module):
    """
    Processes a variable-length sequence of signal-strength feature vectors
    and predicts the trend class (rising / stable / fading).

    Architecture
    ────────────
    GRU(input=64, hidden=64, num_layers=2, batch_first=True)
    → final hidden → Linear(64, 3) → Softmax

    Also exposes the raw 64-dim hidden state as the ``trend_vector``.
    """

    TREND_LABELS: list[str] = ["rising", "stable", "fading"]

    def __init__(self) -> None:
        super().__init__()
        self.gru = nn.GRU(
            input_size=SIGNAL_FEATURE_DIM,
            hidden_size=GRU_HIDDEN_DIM,
            num_layers=GRU_NUM_LAYERS,
            batch_first=True,
        )
        self.classifier = nn.Linear(GRU_HIDDEN_DIM, NUM_TREND_CLASSES)

        _maybe_load_checkpoint(self, "trend_gru")

    def forward(
        self,
        x: torch.Tensor,
        lengths: Optional[torch.Tensor] = None,
    ) -> tuple[torch.Tensor, torch.Tensor]:
        """
        Parameters
        ----------
        x : Tensor of shape ``(batch, seq_len, 64)``
            Padded signal-feature sequences.
        lengths : LongTensor of shape ``(batch,)`` or None
            Actual lengths for each sequence. If ``None``, all sequences
            are treated as fully valid (no padding).

        Returns
        -------
        trend_logits : (batch, 3)  — class logits for rising/stable/fading
        trend_vector : (batch, 64) — raw hidden state for downstream use
        """
        if lengths is not None:
            # Sort by descending length (required by pack_padded_sequence)
            sorted_lengths, sort_idx = lengths.sort(descending=True)
            x_sorted = x[sort_idx]

            packed = pack_padded_sequence(
                x_sorted, sorted_lengths.cpu(), batch_first=True, enforce_sorted=True
            )
            _, hidden = self.gru(packed)
            # hidden: (num_layers, batch, hidden_dim) → take last layer
            last_hidden = hidden[-1]  # (batch, 64)

            # Unsort back to original order
            _, unsort_idx = sort_idx.sort()
            last_hidden = last_hidden[unsort_idx]
        else:
            _, hidden = self.gru(x)
            last_hidden = hidden[-1]

        trend_logits = self.classifier(last_hidden)
        return trend_logits, last_hidden
