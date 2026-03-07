"""
Training script for TrendGRU
─────────────────────────────
Sequence classification: signal feature sequences → rising/stable/fading.
Generates synthetic variable-length trend sequences.
"""

from __future__ import annotations

import random

import numpy as np
import torch
import torch.nn.functional as F
import torch.optim as optim
from torch.nn.utils.rnn import pad_sequence
from torch.utils.data import DataLoader, Dataset

from riqe.config import (
    SIGNAL_FEATURE_DIM,
    NUM_TREND_CLASSES,
    DEFAULT_LR,
    DEFAULT_EPOCHS,
    DEFAULT_BATCH_SIZE,
    CHECKPOINTS_DIR,
)
from riqe.models.models import TrendGRU


class TrendDataset(Dataset):
    """
    Synthetic variable-length sequence dataset.

    Label logic:
      - rising:  strength linearly increases
      - stable:  strength stays roughly constant
      - fading:  strength decreases
    """

    def __init__(self, n_samples: int) -> None:
        self.n_samples = n_samples

    def __len__(self) -> int:
        return self.n_samples

    def __getitem__(self, idx: int) -> dict[str, torch.Tensor]:
        label = random.randint(0, NUM_TREND_CLASSES - 1)
        seq_len = random.randint(3, 20)

        # Generate a synthetic feature sequence
        base = np.random.randn(seq_len, SIGNAL_FEATURE_DIM).astype(np.float32) * 0.1

        if label == 0:  # rising
            scale = np.linspace(0.2, 1.0, seq_len).reshape(-1, 1)
        elif label == 1:  # stable
            scale = np.ones((seq_len, 1)) * 0.5
        else:  # fading
            scale = np.linspace(1.0, 0.2, seq_len).reshape(-1, 1)

        features = base + scale.astype(np.float32)

        return {
            "sequence": torch.tensor(features),
            "length": torch.tensor(seq_len, dtype=torch.long),
            "label": torch.tensor(label, dtype=torch.long),
        }


def collate_fn(batch: list[dict]) -> dict[str, torch.Tensor]:
    """Pad variable-length sequences to the same length within a batch."""
    sequences = [b["sequence"] for b in batch]
    lengths = torch.stack([b["length"] for b in batch])
    labels = torch.stack([b["label"] for b in batch])

    padded = pad_sequence(sequences, batch_first=True, padding_value=0.0)
    return {"sequence": padded, "length": lengths, "label": labels}


def train(
    n_samples: int = 3000,
    epochs: int = DEFAULT_EPOCHS,
    lr: float = DEFAULT_LR,
    batch_size: int = DEFAULT_BATCH_SIZE,
) -> None:
    """Run the sequence-classification training loop and save checkpoint."""
    dataset = TrendDataset(n_samples)
    loader = DataLoader(
        dataset,
        batch_size=batch_size,
        shuffle=True,
        collate_fn=collate_fn,
    )

    model = TrendGRU()
    model.train()
    optimizer = optim.Adam(model.parameters(), lr=lr)

    for epoch in range(1, epochs + 1):
        total_loss = 0.0
        for batch in loader:
            logits, _hidden = model(batch["sequence"], batch["length"])
            loss = F.cross_entropy(logits, batch["label"])

            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            total_loss += loss.item()

        avg = total_loss / len(loader)
        print(f"Epoch {epoch:3d}/{epochs}  loss={avg:.4f}")

    CHECKPOINTS_DIR.mkdir(parents=True, exist_ok=True)
    torch.save(model.state_dict(), CHECKPOINTS_DIR / "trend_gru.pt")
    print(f"✓ Saved checkpoint → {CHECKPOINTS_DIR / 'trend_gru.pt'}")


if __name__ == "__main__":
    train()
