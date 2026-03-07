"""
RIQE Metrics Tracker
────────────────────
Logs roadmap-quality and signal-reliability metrics to MLflow.
"""

from __future__ import annotations

from typing import Any, Optional

import numpy as np
import mlflow

from riqe.config import MLFLOW_TRACKING_URI, MLFLOW_EXPERIMENT_NAME


class MetricsTracker:
    """
    Logs the following metrics on every roadmap update:

    - **roadmap_quality_score** — NDCG@10-style quality of node ordering
    - **signal_reliability**    — variance of strength scores in session
    - **knowledge_state_drift** — cosine distance of user_vector v1 → vN
    - **topic_coverage**        — unique topics surfaced / total available
    - **recommendation_consistency** — Jaccard overlap of top-5 across versions
    """

    def __init__(self) -> None:
        mlflow.set_tracking_uri(MLFLOW_TRACKING_URI)
        mlflow.set_experiment(MLFLOW_EXPERIMENT_NAME)
        self._initial_vectors: dict[str, np.ndarray] = {}
        self._prev_top5: dict[str, set[str]] = {}
        self._total_topics: int = 0

    def set_total_topics(self, n: int) -> None:
        """Set the total number of available topics (for coverage)."""
        self._total_topics = n

    # ── main entry point ──────────────────────────────────────────────

    def log_roadmap_update(
        self,
        user_id: str,
        roadmap: Any,  # Roadmap
        state: Any,  # KnowledgeState
        version: int,
    ) -> dict[str, float]:
        """
        Compute all five metrics and log them to MLflow.
        Returns the metrics dict for caller use.
        """
        metrics: dict[str, float] = {}

        # 1. roadmap quality score
        metrics["roadmap_quality_score"] = self._ndcg_at_10(roadmap)

        # 2. signal reliability
        metrics["signal_reliability"] = self._signal_reliability(state)

        # 3. knowledge state drift
        metrics["knowledge_state_drift"] = self._knowledge_drift(
            user_id, state.user_vector
        )

        # 4. topic coverage
        metrics["topic_coverage"] = self._topic_coverage(roadmap)

        # 5. recommendation consistency
        metrics["recommendation_consistency"] = self._recommendation_consistency(
            user_id, roadmap
        )

        # Log to MLflow
        with mlflow.start_run(run_name=f"{user_id}_v{version}", nested=True):
            mlflow.log_metrics(metrics, step=version)
            mlflow.log_param("user_id", user_id)
            mlflow.log_param("roadmap_version", version)

        return metrics

    # ── metric implementations ────────────────────────────────────────

    @staticmethod
    def _ndcg_at_10(roadmap: Any) -> float:
        """
        Simplified NDCG@10 of node ordering.
        Uses recommendation_score as relevance label.
        """
        nodes = roadmap.nodes[:10]
        if not nodes:
            return 0.0

        # DCG
        dcg = 0.0
        for i, node in enumerate(nodes):
            rel = node.recommendation_score
            dcg += rel / np.log2(i + 2)  # i+2 because log2(1)=0

        # Ideal DCG (nodes sorted by relevance desc)
        ideal = sorted(
            [n.recommendation_score for n in nodes], reverse=True
        )
        idcg = 0.0
        for i, rel in enumerate(ideal):
            idcg += rel / np.log2(i + 2)

        if idcg == 0.0:
            return 0.0
        return float(dcg / idcg)

    @staticmethod
    def _signal_reliability(state: Any) -> float:
        """Variance of signal strengths — lower is more reliable."""
        if not state.strong_signals:
            return 0.0
        strengths = [s.strength for s in state.strong_signals]
        return float(np.var(strengths))

    def _knowledge_drift(
        self, user_id: str, current_vector: np.ndarray
    ) -> float:
        """
        Cosine distance between the initial user_vector and the current one.
        """
        if user_id not in self._initial_vectors:
            self._initial_vectors[user_id] = current_vector.copy()
            return 0.0

        init = self._initial_vectors[user_id]
        dot = np.dot(init, current_vector)
        norm = np.linalg.norm(init) * np.linalg.norm(current_vector) + 1e-8
        cosine_sim = dot / norm
        return float(1.0 - cosine_sim)  # cosine distance

    def _topic_coverage(self, roadmap: Any) -> float:
        """Unique topics surfaced / total available."""
        if self._total_topics == 0:
            return 0.0
        unique = len({n.topic_id for n in roadmap.nodes})
        return float(unique / self._total_topics)

    def _recommendation_consistency(
        self, user_id: str, roadmap: Any
    ) -> float:
        """Jaccard overlap of current top-5 vs previous top-5."""
        current_top5 = {n.topic_id for n in roadmap.nodes[:5]}

        if user_id not in self._prev_top5:
            self._prev_top5[user_id] = current_top5
            return 1.0  # first version → perfectly consistent

        prev = self._prev_top5[user_id]
        intersection = current_top5 & prev
        union = current_top5 | prev

        self._prev_top5[user_id] = current_top5

        if not union:
            return 1.0
        return float(len(intersection) / len(union))
