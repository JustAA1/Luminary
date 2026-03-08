"""
RIQE Roadmap Engine
───────────────────
PrerequisiteGraph: NetworkX DAG for topic ordering with cycle detection.
RoadmapGenerator:  score, generate, and update learning roadmaps.
"""

from __future__ import annotations

import json
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Optional

import numpy as np
import networkx as nx
import torch.nn.functional as F
import torch

from riqe.config import (
    TOPICS_FILE,
    PREREQUISITES_FILE,
    TOP_K_ROADMAP,
    SCORE_WEIGHT_COSINE,
    SCORE_WEIGHT_SIGNAL,
    SCORE_WEIGHT_TREND,
    TREND_RISING_BONUS,
    USER_EMBED_DIM,
)
from riqe.core.knowledge_state import KnowledgeState, RIQESignal


# ═══════════════════════════════════════════════════════════════════════
# Topic dataclass
# ═══════════════════════════════════════════════════════════════════════

@dataclass
class Topic:
    """A single learning topic loaded from ``topics.json``."""
    topic_id: str
    title: str
    description: str
    difficulty: float
    embedding: Optional[np.ndarray] = None  # populated at runtime (384-dim)
    embedding_128: Optional[np.ndarray] = None  # projected (128-dim)


# ═══════════════════════════════════════════════════════════════════════
# RoadmapNode / Roadmap
# ═══════════════════════════════════════════════════════════════════════

@dataclass
class RoadmapNode:
    """One node in the generated roadmap."""
    topic_id: str
    title: str
    description: str
    difficulty: float
    prerequisites: list[str]
    recommendation_score: float
    signal_score: float
    confidence: float
    suggestions: list[str] = field(default_factory=list)  # Gemini: refined next steps, resources
    youtube_queries: list[str] = field(default_factory=list)  # Gemini: search phrases for YouTube API


@dataclass
class Roadmap:
    """An ordered learning roadmap."""
    roadmap_id: str
    user_id: str
    nodes: list[RoadmapNode]
    created_at: datetime
    version: int = 1
    quality_score: float = 0.0

    def to_dict(self) -> dict[str, Any]:
        return {
            "roadmap_id": self.roadmap_id,
            "user_id": self.user_id,
            "nodes": [
                {
                    "topic_id": n.topic_id,
                    "title": n.title,
                    "description": n.description,
                    "difficulty": n.difficulty,
                    "prerequisites": n.prerequisites,
                    "recommendation_score": n.recommendation_score,
                    "signal_score": n.signal_score,
                    "confidence": n.confidence,
                    "suggestions": getattr(n, "suggestions", []),
                    "youtube_queries": getattr(n, "youtube_queries", []),
                }
                for n in self.nodes
            ],
            "created_at": self.created_at.isoformat(),
            "version": self.version,
            "quality_score": self.quality_score,
        }


# ═══════════════════════════════════════════════════════════════════════
# Prerequisite Graph
# ═══════════════════════════════════════════════════════════════════════

class PrerequisiteGraph:
    """
    Wraps a NetworkX DAG.  Edges point from prerequisite → dependent topic.
    Raises ``ValueError`` on cycles.
    """

    def __init__(self, prerequisites_path: str | None = None) -> None:
        self.graph = nx.DiGraph()
        path = prerequisites_path or str(PREREQUISITES_FILE)
        self._load(path)

    def _load(self, path: str) -> None:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        for edge in data["edges"]:
            self.graph.add_edge(edge["from"], edge["to"])
        # Immediate cycle check
        if not nx.is_directed_acyclic_graph(self.graph):
            raise ValueError(
                "Prerequisite graph contains a cycle — cannot topologically sort."
            )

    def topological_sort(self, topic_ids: list[str]) -> list[str]:
        """
        Return *topic_ids* reordered to respect prerequisites.

        Only nodes present in ``topic_ids`` are included; the subgraph is
        extracted before sorting.  Raises ``ValueError`` if a cycle exists
        in the subgraph.
        """
        subgraph = self.graph.subgraph(
            [t for t in topic_ids if t in self.graph]
        )
        if not nx.is_directed_acyclic_graph(subgraph):
            raise ValueError("Cycle detected in the requested topic subgraph.")

        sorted_in_graph = list(nx.topological_sort(subgraph))
        # Preserve topics not in the graph (append at end)
        not_in_graph = [t for t in topic_ids if t not in self.graph]
        return sorted_in_graph + not_in_graph

    def get_prerequisites(self, topic_id: str) -> list[str]:
        """Return direct prerequisites (predecessors) for a topic."""
        if topic_id not in self.graph:
            return []
        return list(self.graph.predecessors(topic_id))

    def filter_known(
        self, topic_ids: list[str], completed: list[str]
    ) -> list[str]:
        """Remove already-completed topics from the list."""
        completed_set = set(completed)
        return [t for t in topic_ids if t not in completed_set]


# ═══════════════════════════════════════════════════════════════════════
# Roadmap Generator
# ═══════════════════════════════════════════════════════════════════════

class RoadmapGenerator:
    """
    Scores topics, generates ordered roadmaps, and handles updates.
    """

    def __init__(
        self,
        prerequisite_graph: PrerequisiteGraph,
        topics: list[Topic],
    ) -> None:
        self.prereq_graph = prerequisite_graph
        self.topics = {t.topic_id: t for t in topics}

    # ── score_topics ──────────────────────────────────────────────────

    def score_topics(
        self,
        state: KnowledgeState,
        all_topics: list[Topic] | None = None,
    ) -> list[tuple[Topic, float]]:
        """
        Score each topic for the user:
          score = 0.6·cosine_sim + 0.3·signal_score + 0.1·trend_bonus

        Returns a descending-sorted list of (Topic, score).
        """
        topics = all_topics or list(self.topics.values())
        scored: list[tuple[Topic, float]] = []

        user_vec = torch.tensor(state.user_vector, dtype=torch.float32)

        for topic in topics:
            # Cosine similarity between user vector and topic embedding
            if topic.embedding_128 is not None:
                topic_vec = torch.tensor(topic.embedding_128, dtype=torch.float32)
                cosine_sim = float(
                    F.cosine_similarity(
                        user_vec.unsqueeze(0), topic_vec.unsqueeze(0)
                    )
                )
            else:
                cosine_sim = 0.0

            # Best signal strength for this topic
            signal_score = 0.0
            trend_bonus = 0.0
            for sig in state.strong_signals:
                if sig.topic == topic.topic_id:
                    signal_score = max(signal_score, sig.strength)
                    if sig.trend == "rising":
                        trend_bonus = TREND_RISING_BONUS

            score = (
                SCORE_WEIGHT_COSINE * cosine_sim
                + SCORE_WEIGHT_SIGNAL * signal_score
                + SCORE_WEIGHT_TREND * trend_bonus
            )
            scored.append((topic, float(score)))

        scored.sort(key=lambda x: x[1], reverse=True)
        return scored

    # ── generate ──────────────────────────────────────────────────────

    def generate(self, state: KnowledgeState) -> Roadmap:
        """
        1. Score all topics
        2. Take top K
        3. Remove completed
        4. Topological sort
        5. Build Roadmap
        """
        scored = self.score_topics(state)
        top_k = scored[:TOP_K_ROADMAP]

        # Remove completed
        topic_ids = self.prereq_graph.filter_known(
            [t.topic_id for t, _ in top_k],
            state.completed_topics,
        )

        # Topological sort
        ordered_ids = self.prereq_graph.topological_sort(topic_ids)

        # Build nodes
        nodes: list[RoadmapNode] = []
        score_map = {t.topic_id: s for t, s in top_k}
        for tid in ordered_ids:
            topic = self.topics.get(tid)
            if topic is None:
                continue
            nodes.append(
                RoadmapNode(
                    topic_id=tid,
                    title=topic.title,
                    description=topic.description,
                    difficulty=topic.difficulty,
                    prerequisites=self.prereq_graph.get_prerequisites(tid),
                    recommendation_score=score_map.get(tid, 0.0),
                    signal_score=self._best_signal_score(state, tid),
                    confidence=1.0 - topic.difficulty,  # simple heuristic
                )
            )

        return Roadmap(
            roadmap_id=str(uuid.uuid4()),
            user_id=state.user_id,
            nodes=nodes,
            created_at=datetime.utcnow(),
        )

    # ── update ────────────────────────────────────────────────────────

    def update(
        self,
        roadmap: Roadmap,
        new_signal: RIQESignal,
        state: KnowledgeState,
    ) -> Roadmap:
        """
        Re-score, rebuild the roadmap, bump version, and compute
        quality_score.
        """
        new_roadmap = self.generate(state)
        new_roadmap.roadmap_id = roadmap.roadmap_id
        new_roadmap.version = roadmap.version + 1
        new_roadmap.quality_score = self._compute_quality(new_roadmap)
        return new_roadmap

    # ── helpers ────────────────────────────────────────────────────────

    @staticmethod
    def _best_signal_score(state: KnowledgeState, topic_id: str) -> float:
        best = 0.0
        for s in state.strong_signals:
            if s.topic == topic_id:
                best = max(best, s.strength)
        return best

    @staticmethod
    def _compute_quality(roadmap: Roadmap) -> float:
        """
        Simple quality heuristic: mean recommendation_score of nodes.
        In production, replace with NDCG@10 against a ground truth.
        """
        if not roadmap.nodes:
            return 0.0
        return float(
            np.mean([n.recommendation_score for n in roadmap.nodes])
        )
