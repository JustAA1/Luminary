"""
RIQE Pipeline Orchestrator — 4-Phase Workflow
──────────────────────────────────────────────
Phase 1: Load user context from Supabase
Phase 2: Gemini generates topic outline from user context + prompt
Phase 3: ML pipeline scores and orders topics
Phase 4: Gemini refines language with ML data → suggestions, youtube, why_this
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
from riqe.config import OPENAI_API_KEY


class RIQEPipeline:
    """
    End-to-end orchestrator with 4-phase workflow.

    Methods
    -------
    onboard            – create initial state + roadmap for a new user
    process_text_input – ingest a signal and return the updated roadmap (4-phase)
    switch_roadmap     – carry knowledge to a new roadmap context (4-phase)
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

    # ═══════════════════════════════════════════════════════════════════
    # Phase 1: Load Context
    # ═══════════════════════════════════════════════════════════════════

    async def _load_user_context(self, user_id: str) -> Optional[dict]:
        """Phase 1: Load user profile from Supabase for Gemini context."""
        try:
            return await db.load_user_profile(user_id)
        except Exception:
            return None

    # ═══════════════════════════════════════════════════════════════════
    # 4-Phase Workflow (shared by process_text_input + switch_roadmap)
    # ═══════════════════════════════════════════════════════════════════

    async def _run_4phase(
        self,
        state: KnowledgeState,
        user_id: str,
        prompt: str = "",
        existing_roadmap: Optional[Roadmap] = None,
    ) -> Roadmap:
        """
        Execute the 4-phase pipeline:
        1. Load user context from Supabase
        2. Gemini topic generation (from context + prompt)
        3. ML pipeline scoring (score + topo sort)
        4. Gemini refinement (suggestions, youtube, why_this)
        """
        import sys

        # Phase 1: Load user context
        user_profile = await self._load_user_context(user_id)
        print(f"RIQE P1: user_profile={'found' if user_profile else 'none'}, OPENAI_KEY={'set' if OPENAI_API_KEY else 'MISSING'}", file=sys.stderr, flush=True)

        # Phase 2: OpenAI topic generation
        gemini_topics: list[dict] = []
        if OPENAI_API_KEY:
            try:
                from riqe.integrations.gemini_client import generate_topic_outline
                existing_ids = [t.topic_id for t in self.topics]
                gemini_topics = generate_topic_outline(
                    user_profile=user_profile,
                    state=state,
                    prompt=prompt,
                    existing_topic_ids=existing_ids,
                )
                print(f"RIQE P2: OpenAI generated {len(gemini_topics)} topics", file=sys.stderr, flush=True)
            except Exception as e:
                print(f"RIQE P2: OpenAI topic gen FAILED: {e}", file=sys.stderr, flush=True)
        else:
            print("RIQE P2: SKIPPED (no OPENAI_API_KEY)", file=sys.stderr, flush=True)

        # Phase 3: ML pipeline scoring
        if gemini_topics:
            # Use dynamic topics from Gemini + static topics, merged and scored
            roadmap = self.roadmap_generator.generate_with_dynamic_topics(
                state, gemini_topics, text_encoder=self.text_encoder,
            )
        else:
            # Fallback to static topics only
            roadmap = self.roadmap_generator.generate(state)
        print(f"RIQE P3: roadmap has {len(roadmap.nodes)} nodes", file=sys.stderr, flush=True)

        # Carry over roadmap_id from existing roadmap if updating
        if existing_roadmap is not None:
            roadmap.roadmap_id = existing_roadmap.roadmap_id
            roadmap.version = existing_roadmap.version + 1
            roadmap.quality_score = self.roadmap_generator._compute_quality(roadmap)

        # Phase 4: OpenAI refinement (language + why_this)
        if OPENAI_API_KEY:
            try:
                from riqe.integrations.gemini_client import generate_roadmap_items, attach_gemini_suggestions_to_roadmap
                items = generate_roadmap_items(state, roadmap, user_profile)
                attach_gemini_suggestions_to_roadmap(roadmap, items)
                enriched = sum(1 for n in roadmap.nodes if getattr(n, 'why_this', ''))
                print(f"RIQE P4: OpenAI enriched {enriched}/{len(roadmap.nodes)} nodes with why_this", file=sys.stderr, flush=True)
            except Exception as e:
                print(f"RIQE P4: OpenAI refinement FAILED: {e}", file=sys.stderr, flush=True)

        return roadmap

    # ═══════════════════════════════════════════════════════════════════
    # Public Methods
    # ═══════════════════════════════════════════════════════════════════

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
        Uses 4-phase workflow for the roadmap generation.
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

        # Build prompt from onboarding data for Phase 2
        prompt = f"Background: {resume_text}. Interests: {', '.join(interests)}. Field: {field_of_study}. Timeframe: {timeframe_weeks} weeks."

        # Run 4-phase pipeline
        roadmap = await self._run_4phase(state, user_id, prompt=prompt)

        # Cache
        self._states[user_id] = state
        self._roadmaps[roadmap.roadmap_id] = roadmap

        # Persist (best-effort)
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

        # Log metrics
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
        Ingest a text signal – classify, update knowledge, rebuild roadmap via 4-phase.

        1. Load KnowledgeState
        2. SignalProcessor.process(text)
        3. KnowledgeStateManager.update_from_signal
        4. Run 4-phase pipeline (Supabase context → Gemini topics → ML scoring → Gemini refinement)
        5. Persist, return
        """
        state = await self._ensure_state(user_id)
        current_roadmap = self._latest_roadmap_for_user(user_id)

        # Signal processing
        signal = self.signal_processor.process(text, datetime.utcnow())

        # Update state
        state = self.ks_manager.update_from_signal(state, signal)
        self._states[user_id] = state

        # Run 4-phase pipeline
        updated = await self._run_4phase(
            state, user_id,
            prompt=text,
            existing_roadmap=current_roadmap,
        )

        self._roadmaps[updated.roadmap_id] = updated

        # Persist (best-effort)
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
        context_text: str = "",
    ) -> tuple[KnowledgeState, Roadmap]:
        """
        Carry the user's knowledge to a new roadmap session via 4-phase.

        1. Load current KnowledgeState
        2. transfer_context → new state
        3. Optionally process context_text as signal
        4. Run 4-phase pipeline (Supabase context → Gemini topics → ML scoring → Gemini refinement)
        5. Persist, return
        """
        old_state = await self._ensure_state(user_id)
        new_state = self.ks_manager.transfer_context(old_state, new_roadmap_id)

        # Process context text as signal if provided
        if context_text.strip():
            signal = self.signal_processor.process(context_text, datetime.utcnow())
            new_state = self.ks_manager.update_from_signal(new_state, signal)

        # Run 4-phase pipeline
        new_roadmap = await self._run_4phase(
            new_state, user_id,
            prompt=context_text,
        )
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

    # ═══════════════════════════════════════════════════════════════════
    # Helpers
    # ═══════════════════════════════════════════════════════════════════

    async def _ensure_state(self, user_id: str) -> KnowledgeState:
        """Return cached state or load from Supabase; auto-init if not found."""
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
