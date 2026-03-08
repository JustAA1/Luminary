"""
RIQE Pipeline Orchestrator
──────────────────────────
Top-level class that wires together all components:
  encoders → models → knowledge state → roadmap engine → signal processor
"""

from __future__ import annotations

import json
from datetime import datetime
from typing import Any, Optional

import numpy as np

from riqe.config import TOPICS_FILE, USER_EMBED_DIM
from riqe.db import db
from riqe.models.encoders import TextEncoder, StructuredEncoder
from riqe.models.models import UserProfileMLP, RIQESignalClassifier, TrendGRU
from riqe.core.knowledge_state import KnowledgeState, KnowledgeStateManager, RIQESignal
from riqe.core.roadmap_engine import (
    PrerequisiteGraph,
    RoadmapGenerator,
    Roadmap,
    Topic,
)
from riqe.core.signal_processor import SignalProcessor
from riqe.metrics import MetricsTracker
from riqe.config import GEMINI_API_KEY


class RIQEPipeline:
    """
    End-to-end orchestrator.

    Methods
    -------
    onboard            – create initial state + roadmap for a new user
    process_text_input – ingest a signal and return the updated roadmap
    switch_roadmap     – carry knowledge to a new roadmap context
    load_state         – retrieve persisted knowledge state
    load_roadmap_history – retrieve all roadmap versions
    """

    def __init__(self) -> None:
        # Encoders
        self.text_encoder = TextEncoder()

        # PyTorch models
        self.user_mlp = UserProfileMLP()
        self.signal_classifier = RIQESignalClassifier()
        self.trend_gru = TrendGRU()

        # Core managers
        self.ks_manager = KnowledgeStateManager(
            text_encoder=self.text_encoder,
            user_mlp=self.user_mlp,
        )

        # Load topics and build embeddings
        self.topics = self._load_topics()

        # Graph + generator
        self.prereq_graph = PrerequisiteGraph()
        self.roadmap_generator = RoadmapGenerator(
            prerequisite_graph=self.prereq_graph,
            topics=self.topics,
        )

        # Signal processor
        topic_ids = [t.topic_id for t in self.topics]
        self.signal_processor = SignalProcessor(
            text_encoder=self.text_encoder,
            signal_classifier=self.signal_classifier,
            trend_gru=self.trend_gru,
            topic_id_list=topic_ids,
        )

        # Metrics
        self.metrics = MetricsTracker()

        # In-memory caches (backed by Supabase for persistence)
        self._states: dict[str, KnowledgeState] = {}
        self._roadmaps: dict[str, Roadmap] = {}

    # ── onboard ───────────────────────────────────────────────────────

    async def onboard(
        self,
        user_id: str,
        resume_text: str,
        skill_scores: dict[str, float],
        interests: list[str],
        field_of_study: str,
        timeframe_weeks: int,
        learning_history: list[dict] | None = None,
    ) -> tuple[KnowledgeState, Roadmap]:
        """
        Create initial knowledge state and generate a personalised roadmap.

        1. KnowledgeStateManager.initialize(profile)
        2. RoadmapGenerator.generate(state)
        3. Persist both to Supabase
        4. Return (state, roadmap)
        """
        state = self.ks_manager.initialize(
            user_id=user_id,
            resume_text=resume_text,
            skill_scores=skill_scores,
            interests=interests,
            field_of_study=field_of_study,
            timeframe_weeks=timeframe_weeks,
            learning_history=learning_history,
        )

        roadmap = self.roadmap_generator.generate(state)

        # Gemini: generate roadmap items from pipeline output and attach to nodes
        if GEMINI_API_KEY:
            try:
                from riqe.integrations.gemini_client import generate_roadmap_items, attach_gemini_suggestions_to_roadmap
                items = generate_roadmap_items(state, roadmap)
                attach_gemini_suggestions_to_roadmap(roadmap, items)
            except Exception:
                pass  # don't fail onboard if Gemini fails

        # Cache
        self._states[user_id] = state
        self._roadmaps[roadmap.roadmap_id] = roadmap

        # Persist (best-effort — don't fail onboard if Supabase is unavailable)
        try:
            await db.save_knowledge_state(user_id, state.to_dict())
            await db.save_roadmap(roadmap.to_dict())
            await db.save_roadmap_snapshot(
                roadmap.user_id,
                roadmap.roadmap_id,
                [n.title for n in roadmap.nodes],
            )
        except Exception:
            pass

        # Log initial metrics
        try:
            self.metrics.log_roadmap_update(
                user_id=user_id,
                roadmap=roadmap,
                state=state,
                version=1,
            )
        except Exception:
            pass

        return state, roadmap

    # ── process_text_input ────────────────────────────────────────────

    async def process_text_input(
        self,
        user_id: str,
        text: str,
    ) -> Roadmap:
        """
        Ingest a text signal – classify, update knowledge, rebuild roadmap.

        1. Load KnowledgeState (cache or Supabase)
        2. SignalProcessor.process(text)
        3. KnowledgeStateManager.update_from_signal
        4. RoadmapGenerator.update
        5. Persist, return updated Roadmap
        """
        state = await self._ensure_state(user_id)
        current_roadmap = self._latest_roadmap_for_user(user_id)

        # Signal processing
        signal = self.signal_processor.process(text, datetime.utcnow())

        # Update state
        state = self.ks_manager.update_from_signal(state, signal)
        self._states[user_id] = state

        # Update roadmap
        if current_roadmap is not None:
            updated = self.roadmap_generator.update(current_roadmap, signal, state)
        else:
            updated = self.roadmap_generator.generate(state)

        # Gemini: regenerate roadmap items for updated state/roadmap
        if GEMINI_API_KEY:
            try:
                from riqe.integrations.gemini_client import generate_roadmap_items, attach_gemini_suggestions_to_roadmap
                items = generate_roadmap_items(state, updated)
                attach_gemini_suggestions_to_roadmap(updated, items)
            except Exception:
                pass

        self._roadmaps[updated.roadmap_id] = updated

        # Persist (best-effort — don't crash if Supabase is unavailable)
        try:
            await db.save_knowledge_state(user_id, state.to_dict())
            await db.save_roadmap(updated.to_dict())
            await db.save_roadmap_snapshot(
                updated.user_id,
                updated.roadmap_id,
                [n.title for n in updated.nodes],
            )
            await db.save_signal(user_id, {
                "text": signal.text,
                "topic": signal.topic,
                "strength": signal.strength,
                "signal_type": signal.signal_type,
                "trend": signal.trend,
                "reliability_score": signal.reliability_score,
                "timestamp": signal.timestamp.isoformat(),
            })
        except Exception:
            pass

        # Log metrics
        try:
            self.metrics.log_roadmap_update(
                user_id=user_id,
                roadmap=updated,
                state=state,
                version=updated.version,
            )
        except Exception:
            pass

        return updated

    # ── switch_roadmap ────────────────────────────────────────────────

    async def switch_roadmap(
        self,
        user_id: str,
        new_roadmap_id: str,
    ) -> tuple[KnowledgeState, Roadmap]:
        """
        Carry the user's knowledge to a new roadmap session.

        1. Load current KnowledgeState
        2. transfer_context → new state
        3. generate new roadmap (pre-personalised)
        4. Persist, return
        """
        old_state = await self._ensure_state(user_id)
        new_state = self.ks_manager.transfer_context(old_state, new_roadmap_id)

        new_roadmap = self.roadmap_generator.generate(new_state)
        new_roadmap.roadmap_id = new_roadmap_id

        self._states[user_id] = new_state
        self._roadmaps[new_roadmap_id] = new_roadmap

        # Persist (best-effort)
        try:
            await db.save_knowledge_state(user_id, new_state.to_dict())
            await db.save_roadmap(new_roadmap.to_dict())
            await db.save_roadmap_snapshot(
                new_roadmap.user_id,
                new_roadmap.roadmap_id,
                [n.title for n in new_roadmap.nodes],
            )
        except Exception:
            pass

        try:
            self.metrics.log_roadmap_update(
                user_id=user_id,
                roadmap=new_roadmap,
                state=new_state,
                version=1,
            )
        except Exception:
            pass

        return new_state, new_roadmap

    # ── helpers ───────────────────────────────────────────────────────

    async def _ensure_state(self, user_id: str) -> KnowledgeState:
        """Return cached state or load from Supabase; auto-init a blank state if not found.

        A blank state is used when the daemon restarted and Supabase has no record
        yet (e.g. user calls signal/switch before onboarding completes, or after a
        hot-reload wipes in-memory state). The next onboard() call will overwrite it.
        """
        if user_id in self._states:
            return self._states[user_id]
        try:
            row = await db.load_knowledge_state(user_id)
        except Exception:
            row = None
        if row is None:
            state = KnowledgeState(
                user_id=user_id,
                user_vector=np.zeros(USER_EMBED_DIM, dtype=np.float32),
            )
        else:
            state = KnowledgeState.from_dict(row)
        self._states[user_id] = state
        return state

    def _latest_roadmap_for_user(self, user_id: str) -> Optional[Roadmap]:
        """Return the most recent roadmap for a user (from cache)."""
        candidates = [
            rm for rm in self._roadmaps.values() if rm.user_id == user_id
        ]
        if not candidates:
            return None
        return max(candidates, key=lambda r: r.version)

    def _load_topics(self) -> list[Topic]:
        """Load topics from JSON and compute embeddings."""
        with open(str(TOPICS_FILE), "r", encoding="utf-8") as f:
            raw = json.load(f)

        topics: list[Topic] = []
        for t in raw:
            topic = Topic(
                topic_id=t["topic_id"],
                title=t["title"],
                description=t["description"],
                difficulty=t["difficulty"],
            )
            # Compute embeddings
            full_text = f"{topic.title}. {topic.description}"
            topic.embedding = self.text_encoder.encode(full_text)
            # Project 384 → 128 (same approach as knowledge_state)
            topic.embedding_128 = topic.embedding.reshape(3, 128).mean(axis=0)
            topics.append(topic)

        return topics
