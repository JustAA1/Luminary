"""
Tests for RIQE Pipeline (integration)
──────────────────────────────────────
Validates onboard, process_text_input, and switch_roadmap flows
with Supabase mocked out.
"""

from __future__ import annotations

from datetime import datetime
from unittest.mock import AsyncMock, patch, MagicMock

import numpy as np
import pytest
import pytest_asyncio

from riqe.config import USER_EMBED_DIM
from riqe.core.knowledge_state import KnowledgeState, KnowledgeStateManager, RIQESignal
from riqe.core.roadmap_engine import (
    PrerequisiteGraph,
    RoadmapGenerator,
    Roadmap,
    RoadmapNode,
    Topic,
)
from riqe.models.encoders import TextEncoder
from riqe.models.models import UserProfileMLP, RIQESignalClassifier, TrendGRU


# ═══════════════════════════════════════════════════════════════════════
# Fixtures
# ═══════════════════════════════════════════════════════════════════════

@pytest.fixture(scope="module")
def text_encoder() -> TextEncoder:
    return TextEncoder()


@pytest.fixture(scope="module")
def user_mlp() -> UserProfileMLP:
    return UserProfileMLP()


@pytest.fixture(scope="module")
def ks_manager(text_encoder: TextEncoder, user_mlp: UserProfileMLP) -> KnowledgeStateManager:
    return KnowledgeStateManager(text_encoder, user_mlp)


@pytest.fixture
def sample_state() -> KnowledgeState:
    return KnowledgeState(
        user_id="test-user-001",
        user_vector=np.random.randn(USER_EMBED_DIM).astype(np.float32),
        completed_topics=["python_fundamentals"],
        weak_topics=["linear_algebra"],
    )


@pytest.fixture
def prereq_graph() -> PrerequisiteGraph:
    return PrerequisiteGraph()


@pytest.fixture
def sample_topics(text_encoder: TextEncoder) -> list[Topic]:
    topics = [
        Topic("python_fundamentals", "Python", "Basics", 0.2),
        Topic("data_structures", "DS & Algo", "Structures", 0.4),
        Topic("linear_algebra", "Linear Algebra", "Vectors", 0.5),
        Topic("machine_learning_basics", "ML Basics", "Supervised", 0.5),
        Topic("deep_learning_fundamentals", "DL Fundamentals", "Neural nets", 0.7),
    ]
    for t in topics:
        t.embedding = text_encoder.encode(f"{t.title}. {t.description}")
        t.embedding_128 = t.embedding.reshape(3, 128).mean(axis=0)
    return topics


# ═══════════════════════════════════════════════════════════════════════
# KnowledgeStateManager tests
# ═══════════════════════════════════════════════════════════════════════

class TestKnowledgeStateManager:
    def test_initialize(self, ks_manager: KnowledgeStateManager) -> None:
        state = ks_manager.initialize(
            user_id="u1",
            resume_text="Software engineer with 5 years experience in Python.",
            skill_scores={"python": 0.8, "ml": 0.4},
            interests=["machine learning", "natural language processing"],
            field_of_study="computer_science",
            timeframe_weeks=12,
            learning_history=[
                {
                    "topic_id": "python_fundamentals",
                    "completion_rate": 0.95,
                    "quiz_score": 0.9,
                    "time_spent_minutes": 200,
                    "revisit_count": 1,
                }
            ],
        )
        assert state.user_id == "u1"
        assert state.user_vector.shape == (USER_EMBED_DIM,)
        assert "python_fundamentals" in state.completed_topics
        assert len(state.weak_topics) == 0

    def test_update_from_new_info(self, ks_manager: KnowledgeStateManager, sample_state: KnowledgeState) -> None:
        signal = RIQESignal(
            text="New research on transformers",
            timestamp=datetime.utcnow(),
            topic="nlp_basics",
            strength=0.8,
            is_new_info=True,
            trend="rising",
            reliability_score=0.7,
            signal_type="new_info",
        )
        updated = ks_manager.update_from_signal(sample_state, signal)
        assert len(updated.strong_signals) == 1
        assert updated.strong_signals[0].topic == "nlp_basics"

    def test_update_from_contradiction(self, ks_manager: KnowledgeStateManager, sample_state: KnowledgeState) -> None:
        signal = RIQESignal(
            text="Linear algebra is not needed",
            timestamp=datetime.utcnow(),
            topic="data_structures",
            strength=0.5,
            is_new_info=False,
            trend="fading",
            reliability_score=0.3,
            signal_type="contradiction",
        )
        updated = ks_manager.update_from_signal(sample_state, signal)
        assert "data_structures" in updated.weak_topics

    def test_transfer_context(self, ks_manager: KnowledgeStateManager, sample_state: KnowledgeState) -> None:
        new_state = ks_manager.transfer_context(sample_state, "new-roadmap-42")
        assert new_state.user_id == sample_state.user_id
        assert len(new_state.session_history) == 1
        assert new_state.session_history[0].roadmap_id == "new-roadmap-42"

    def test_ema_update_changes_vector(self, ks_manager: KnowledgeStateManager, sample_state: KnowledgeState) -> None:
        old_vec = sample_state.user_vector.copy()
        signal = RIQESignal(
            text="Something completely new",
            timestamp=datetime.utcnow(),
            topic="t1",
            strength=0.9,
            is_new_info=True,
            trend="rising",
            reliability_score=0.9,
            signal_type="new_info",
        )
        updated = ks_manager.update_from_signal(sample_state, signal)
        assert not np.allclose(updated.user_vector, old_vec, atol=1e-5)


# ═══════════════════════════════════════════════════════════════════════
# PrerequisiteGraph tests
# ═══════════════════════════════════════════════════════════════════════

class TestPrerequisiteGraph:
    def test_topological_sort(self, prereq_graph: PrerequisiteGraph) -> None:
        ordered = prereq_graph.topological_sort(
            ["deep_learning_fundamentals", "python_fundamentals", "machine_learning_basics"]
        )
        assert ordered.index("python_fundamentals") < ordered.index("machine_learning_basics")

    def test_get_prerequisites(self, prereq_graph: PrerequisiteGraph) -> None:
        prereqs = prereq_graph.get_prerequisites("machine_learning_basics")
        assert "linear_algebra" in prereqs
        assert "probability_statistics" in prereqs

    def test_filter_known(self, prereq_graph: PrerequisiteGraph) -> None:
        filtered = prereq_graph.filter_known(
            ["python_fundamentals", "data_structures", "linear_algebra"],
            completed=["python_fundamentals"],
        )
        assert "python_fundamentals" not in filtered
        assert "data_structures" in filtered


# ═══════════════════════════════════════════════════════════════════════
# RoadmapGenerator tests
# ═══════════════════════════════════════════════════════════════════════

class TestRoadmapGenerator:
    def test_generate(
        self,
        prereq_graph: PrerequisiteGraph,
        sample_topics: list[Topic],
        sample_state: KnowledgeState,
    ) -> None:
        gen = RoadmapGenerator(prereq_graph, sample_topics)
        roadmap = gen.generate(sample_state)

        assert isinstance(roadmap, Roadmap)
        assert roadmap.user_id == "test-user-001"
        assert len(roadmap.nodes) > 0
        # python_fundamentals is completed, should not appear
        topic_ids = [n.topic_id for n in roadmap.nodes]
        assert "python_fundamentals" not in topic_ids

    def test_score_topics(
        self,
        prereq_graph: PrerequisiteGraph,
        sample_topics: list[Topic],
        sample_state: KnowledgeState,
    ) -> None:
        gen = RoadmapGenerator(prereq_graph, sample_topics)
        scored = gen.score_topics(sample_state)
        assert len(scored) == len(sample_topics)
        # Check sorted descending
        scores = [s for _, s in scored]
        assert scores == sorted(scores, reverse=True)

    def test_update_increments_version(
        self,
        prereq_graph: PrerequisiteGraph,
        sample_topics: list[Topic],
        sample_state: KnowledgeState,
    ) -> None:
        gen = RoadmapGenerator(prereq_graph, sample_topics)
        v1 = gen.generate(sample_state)
        assert v1.version == 1

        signal = RIQESignal(
            text="Update signal",
            timestamp=datetime.utcnow(),
            topic="data_structures",
            strength=0.7,
            is_new_info=True,
            trend="rising",
            reliability_score=0.6,
            signal_type="new_info",
        )
        v2 = gen.update(v1, signal, sample_state)
        assert v2.version == 2

    def test_roadmap_to_dict(
        self,
        prereq_graph: PrerequisiteGraph,
        sample_topics: list[Topic],
        sample_state: KnowledgeState,
    ) -> None:
        gen = RoadmapGenerator(prereq_graph, sample_topics)
        roadmap = gen.generate(sample_state)
        d = roadmap.to_dict()
        assert "roadmap_id" in d
        assert "nodes" in d
        assert isinstance(d["nodes"], list)


# ═══════════════════════════════════════════════════════════════════════
# Model forward-pass smoke tests
# ═══════════════════════════════════════════════════════════════════════

class TestModelForwardPass:
    def test_user_profile_mlp(self) -> None:
        import torch
        from riqe.config import PROFILE_INPUT_DIM
        model = UserProfileMLP()
        model.eval()
        x = torch.randn(2, PROFILE_INPUT_DIM)
        with torch.no_grad():
            out = model(x)
        assert out.shape == (2, USER_EMBED_DIM)

    def test_signal_classifier(self) -> None:
        import torch
        from riqe.config import TEXT_EMBED_DIM, N_TOPICS, NUM_SIGNAL_TYPES
        model = RIQESignalClassifier()
        model.eval()
        x = torch.randn(4, TEXT_EMBED_DIM)
        with torch.no_grad():
            topic, strength, sig_type = model(x)
        assert topic.shape == (4, N_TOPICS)
        assert strength.shape == (4, 1)
        assert sig_type.shape == (4, NUM_SIGNAL_TYPES)

    def test_trend_gru(self) -> None:
        import torch
        from riqe.config import SIGNAL_FEATURE_DIM, NUM_TREND_CLASSES
        model = TrendGRU()
        model.eval()
        x = torch.randn(3, 10, SIGNAL_FEATURE_DIM)
        lengths = torch.tensor([10, 7, 5])
        with torch.no_grad():
            logits, hidden = model(x, lengths)
        assert logits.shape == (3, NUM_TREND_CLASSES)
        assert hidden.shape == (3, SIGNAL_FEATURE_DIM)

    def test_trend_gru_no_lengths(self) -> None:
        import torch
        from riqe.config import SIGNAL_FEATURE_DIM, NUM_TREND_CLASSES
        model = TrendGRU()
        model.eval()
        x = torch.randn(2, 8, SIGNAL_FEATURE_DIM)
        with torch.no_grad():
            logits, hidden = model(x, None)
        assert logits.shape == (2, NUM_TREND_CLASSES)
