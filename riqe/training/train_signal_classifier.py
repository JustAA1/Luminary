"""
Training script for RIQESignalClassifier
─────────────────────────────────────────
Multi-head training: topic classification + strength regression + signal type.
Generates synthetic labelled signal data.
"""

from __future__ import annotations

import random

import numpy as np
import torch
import torch.optim as optim
from torch.utils.data import DataLoader, Dataset

from riqe.config import (
    TEXT_EMBED_DIM,
    N_TOPICS,
    NUM_SIGNAL_TYPES,
    DEFAULT_LR,
    DEFAULT_EPOCHS,
    DEFAULT_BATCH_SIZE,
    CHECKPOINTS_DIR,
)
from riqe.models.models import RIQESignalClassifier


class SignalDataset(Dataset):
    """
    Synthetic dataset for multi-head signal classification.

    Each sample:
      - input      : (384,) random embedding
      - topic_label: int  in [0, N_TOPICS)
      - strength   : float in [0, 1]
      - type_label : int  in [0, 3)
    """

    def __init__(self, n_samples: int) -> None:
        self.n_samples = n_samples

    def __len__(self) -> int:
        return self.n_samples

    def __getitem__(self, idx: int) -> dict[str, torch.Tensor]:
        embed = np.random.randn(TEXT_EMBED_DIM).astype(np.float32) * 0.1
        topic = random.randint(0, N_TOPICS - 1)
        strength = random.random()
        sig_type = random.randint(0, NUM_SIGNAL_TYPES - 1)

        return {
            "input": torch.tensor(embed),
            "topic": torch.tensor(topic, dtype=torch.long),
            "strength": torch.tensor(strength, dtype=torch.float32),
            "signal_type": torch.tensor(sig_type, dtype=torch.long),
        }


def train(
    n_samples: int = 3000,
    epochs: int = DEFAULT_EPOCHS,
    lr: float = DEFAULT_LR,
    batch_size: int = DEFAULT_BATCH_SIZE,
) -> None:
    """Run the multi-head training loop and save the checkpoint."""
    dataset = SignalDataset(n_samples)
    loader = DataLoader(dataset, batch_size=batch_size, shuffle=True)

    model = RIQESignalClassifier()
    model.train()
    optimizer = optim.Adam(model.parameters(), lr=lr)

    for epoch in range(1, epochs + 1):
        total_loss = 0.0
        for batch in loader:
            topic_logits, strength_pred, type_logits = model(batch["input"])

            loss = RIQESignalClassifier.composite_loss(
                topic_logits=topic_logits,
                topic_targets=batch["topic"],
                strength_pred=strength_pred,
                strength_targets=batch["strength"],
                type_logits=type_logits,
                type_targets=batch["signal_type"],
            )

            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            total_loss += loss.item()

        avg = total_loss / len(loader)
        print(f"Epoch {epoch:3d}/{epochs}  loss={avg:.4f}")

    CHECKPOINTS_DIR.mkdir(parents=True, exist_ok=True)
    torch.save(model.state_dict(), CHECKPOINTS_DIR / "signal_classifier.pt")
    print(f"✓ Saved checkpoint → {CHECKPOINTS_DIR / 'signal_classifier.pt'}")


if __name__ == "__main__":
    train()
