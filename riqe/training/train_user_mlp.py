"""
Training script for UserProfileMLP
───────────────────────────────────
Uses triplet loss: anchor=user, positive=completed-topic embedding,
negative=random-topic embedding.

Generates synthetic training data from topics.json for bootstrap training.
"""

from __future__ import annotations

import json
import random
from pathlib import Path

import numpy as np
import torch
import torch.optim as optim
from torch.utils.data import DataLoader, Dataset

from riqe.config import (
    TOPICS_FILE,
    CHECKPOINTS_DIR,
    PROFILE_INPUT_DIM,
    USER_EMBED_DIM,
    DEFAULT_LR,
    DEFAULT_EPOCHS,
    DEFAULT_BATCH_SIZE,
    TRIPLET_MARGIN,
)
from riqe.models.models import UserProfileMLP


class TripletDataset(Dataset):
    """
    Synthetic triplet dataset.

    Each sample: (anchor_profile_vec, positive_topic_vec, negative_topic_vec)
    where anchor is a random profile vector, positive is a topic embedding
    the user 'completed', negative is a random other embedding.
    """

    def __init__(self, n_samples: int, topic_embeddings: np.ndarray) -> None:
        self.n_samples = n_samples
        self.topic_embeddings = topic_embeddings  # (N_topics, 128)
        self.n_topics = topic_embeddings.shape[0]

    def __len__(self) -> int:
        return self.n_samples

    def __getitem__(self, idx: int) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        # Synthetic anchor: random profile vector
        anchor = np.random.randn(PROFILE_INPUT_DIM).astype(np.float32) * 0.1

        # Positive: a random topic embedding
        pos_idx = random.randint(0, self.n_topics - 1)
        positive = self.topic_embeddings[pos_idx]

        # Negative: different random topic
        neg_idx = random.randint(0, self.n_topics - 2)
        if neg_idx >= pos_idx:
            neg_idx += 1
        negative = self.topic_embeddings[neg_idx]

        return (
            torch.tensor(anchor),
            torch.tensor(positive, dtype=torch.float32),
            torch.tensor(negative, dtype=torch.float32),
        )


def build_topic_embeddings() -> np.ndarray:
    """Load topics and create random 128-dim embeddings (bootstrap)."""
    with open(str(TOPICS_FILE), "r", encoding="utf-8") as f:
        topics = json.load(f)
    n = len(topics)
    return np.random.randn(n, USER_EMBED_DIM).astype(np.float32)


def train(
    n_samples: int = 2000,
    epochs: int = DEFAULT_EPOCHS,
    lr: float = DEFAULT_LR,
    batch_size: int = DEFAULT_BATCH_SIZE,
) -> None:
    """Run the triplet-loss training loop and save the checkpoint."""
    topic_embeds = build_topic_embeddings()
    dataset = TripletDataset(n_samples, topic_embeds)
    loader = DataLoader(dataset, batch_size=batch_size, shuffle=True)

    model = UserProfileMLP()
    model.train()
    optimizer = optim.Adam(model.parameters(), lr=lr)

    for epoch in range(1, epochs + 1):
        total_loss = 0.0
        for anchor, positive, negative in loader:
            anchor_out = model(anchor)
            # positive / negative are already 128-dim
            loss = UserProfileMLP.triplet_loss(anchor_out, positive, negative)

            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            total_loss += loss.item()

        avg = total_loss / len(loader)
        print(f"Epoch {epoch:3d}/{epochs}  loss={avg:.4f}")

    # Save
    CHECKPOINTS_DIR.mkdir(parents=True, exist_ok=True)
    torch.save(model.state_dict(), CHECKPOINTS_DIR / "user_profile_mlp.pt")
    print(f"✓ Saved checkpoint → {CHECKPOINTS_DIR / 'user_profile_mlp.pt'}")


if __name__ == "__main__":
    train()
