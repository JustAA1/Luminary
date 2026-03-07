"""
RIQE End-to-End Pipeline Runner
────────────────────────────────
Runs the full pipeline against sample data — NO Supabase required.
All state is held in-memory.

Usage:
    python -m riqe.run_e2e
"""

from __future__ import annotations

import json
import sys
from datetime import datetime
from pathlib import Path

import numpy as np

# ── Patch db module BEFORE importing pipeline ─────────────────────────
# Replace all Supabase calls with no-ops so the pipeline runs in-memory.
import riqe.db as db_module

class _NoOpDB:
    """Drop-in replacement for SupabaseClient that stores nothing."""
    async def save_knowledge_state(self, *a, **kw) -> None: pass
    async def load_knowledge_state(self, *a, **kw): return None
    async def save_roadmap(self, *a, **kw) -> None: pass
    async def load_roadmap(self, *a, **kw): return None
    async def load_roadmap_history(self, *a, **kw): return []
    async def load_current_roadmap_for_user(self, *a, **kw): return None
    async def save_signal(self, *a, **kw) -> None: pass
    async def save_metrics(self, *a, **kw) -> None: pass
    async def load_metrics(self, *a, **kw): return []

db_module.db = _NoOpDB()

# ── Now safe to import pipeline ───────────────────────────────────────
from riqe.config import TRAINING_DATA_DIR
from riqe.models.encoders import TextEncoder
from riqe.models.models import UserProfileMLP, RIQESignalClassifier, TrendGRU
from riqe.core.knowledge_state import KnowledgeStateManager
from riqe.core.roadmap_engine import PrerequisiteGraph, RoadmapGenerator, Topic, Roadmap
from riqe.core.signal_processor import SignalProcessor
from riqe.metrics import MetricsTracker


# =====================================================================
# Helpers
# =====================================================================

def _hr(title: str = "") -> None:
    """Print a horizontal rule with optional title."""
    if title:
        print(f"\n{'=' * 20} {title} {'=' * 20}")
    else:
        print("-" * 60)


def _print_roadmap(roadmap: Roadmap) -> None:
    """Pretty-print a roadmap."""
    print(f"  Roadmap ID : {roadmap.roadmap_id[:12]}...")
    print(f"  Version    : {roadmap.version}")
    print(f"  Quality    : {roadmap.quality_score:.4f}")
    print(f"  Nodes ({len(roadmap.nodes)}):")
    for i, node in enumerate(roadmap.nodes, 1):
        prereqs = ", ".join(node.prerequisites) if node.prerequisites else "none"
        print(
            f"    {i:2d}. [{node.topic_id}] "
            f"score={node.recommendation_score:.3f}  "
            f"signal={node.signal_score:.3f}  "
            f"conf={node.confidence:.2f}  "
            f"prereqs=[{prereqs}]"
        )


# =====================================================================
# Main E2E Runner
# =====================================================================

def main() -> None:
    _hr("RIQE END-TO-END PIPELINE")
    print("Loading models and data...")

    # -- 1. Initialise all components ----------------------------------
    text_encoder = TextEncoder()
    user_mlp = UserProfileMLP()
    signal_classifier = RIQESignalClassifier()
    trend_gru = TrendGRU()

    ks_manager = KnowledgeStateManager(text_encoder, user_mlp)
    prereq_graph = PrerequisiteGraph()

    # Load topics and compute embeddings
    from riqe.config import TOPICS_FILE
    with open(str(TOPICS_FILE), "r", encoding="utf-8") as f:
        raw_topics = json.load(f)
    topics: list[Topic] = []
    for t in raw_topics:
        topic = Topic(
            topic_id=t["topic_id"],
            title=t["title"],
            description=t["description"],
            difficulty=t["difficulty"],
        )
        full_text = f"{topic.title}. {topic.description}"
        topic.embedding = text_encoder.encode(full_text)
        topic.embedding_128 = topic.embedding.reshape(3, 128).mean(axis=0)
        topics.append(topic)

    roadmap_generator = RoadmapGenerator(prereq_graph, topics)

    topic_ids = [t.topic_id for t in topics]
    signal_processor = SignalProcessor(
        text_encoder, signal_classifier, trend_gru, topic_id_list=topic_ids,
    )

    metrics_tracker = MetricsTracker()
    metrics_tracker.set_total_topics(len(topics))

    print(f"[OK] Models loaded  |  {len(topics)} topics  |  Ready\n")

    # -- 2. Load sample data -------------------------------------------
    users_path = TRAINING_DATA_DIR / "sample_users.json"
    signals_path = TRAINING_DATA_DIR / "sample_signals.json"

    with open(str(users_path), "r", encoding="utf-8") as f:
        users = json.load(f)
    with open(str(signals_path), "r", encoding="utf-8") as f:
        all_signals = json.load(f)

    print(f"[OK] Loaded {len(users)} users, {len(all_signals)} signals\n")

    # -- 3. Process each user ------------------------------------------
    for user_data in users:
        uid = user_data["user_id"]
        _hr(f"USER: {uid}")

        # -- 3a. ONBOARD -----------------------------------------------
        print(f"\n  [Resume]    {user_data['resume_text'][:80]}...")
        print(f"  [Interests] {user_data['interests']}")
        print(f"  [Skills]    {user_data['skill_scores']}")
        print(f"  [Field]     {user_data['field_of_study']}")
        print(f"  [Timeframe] {user_data['timeframe_weeks']} weeks")
        print(f"  [History]   {len(user_data['learning_history'])} events")

        # Clean & transform: pipeline handles this
        state = ks_manager.initialize(
            user_id=uid,
            resume_text=user_data["resume_text"],
            skill_scores=user_data["skill_scores"],
            interests=user_data["interests"],
            field_of_study=user_data["field_of_study"],
            timeframe_weeks=user_data["timeframe_weeks"],
            learning_history=user_data["learning_history"] or None,
        )

        print(f"\n  [OK] Knowledge State initialised")
        print(f"    User vector (first 8): {np.round(state.user_vector[:8], 3)}")
        print(f"    Completed topics: {state.completed_topics}")
        print(f"    Weak topics: {state.weak_topics}")

        # Generate initial roadmap
        roadmap = roadmap_generator.generate(state)
        print(f"\n  [OK] Initial Roadmap generated:")
        _print_roadmap(roadmap)

        # Log initial metrics
        m = metrics_tracker.log_roadmap_update(uid, roadmap, state, version=1)
        print(f"\n  [Metrics] quality={m['roadmap_quality_score']:.3f}  "
              f"coverage={m['topic_coverage']:.3f}  "
              f"consistency={m['recommendation_consistency']:.3f}")

        # -- 3b. PROCESS SIGNALS ----------------------------------------
        user_signals = [s for s in all_signals if s["user_id"] == uid]
        if user_signals:
            print(f"\n  -- Processing {len(user_signals)} signals --")

        for i, sig_data in enumerate(user_signals, 1):
            text = sig_data["text"]
            print(f"\n  Signal {i}: \"{text[:70]}...\"")

            # Pipeline processes raw text -> classified signal
            signal = signal_processor.process(text, datetime.utcnow())

            print(f"    -> Topic: {signal.topic}")
            print(f"    -> Strength: {signal.strength:.3f}")
            print(f"    -> Type: {signal.signal_type}")
            print(f"    -> Trend: {signal.trend}")
            print(f"    -> Reliability: {signal.reliability_score:.3f}")

            # Update knowledge state
            state = ks_manager.update_from_signal(state, signal)

            # Update roadmap
            roadmap = roadmap_generator.update(roadmap, signal, state)

            # Log metrics
            m = metrics_tracker.log_roadmap_update(
                uid, roadmap, state, version=roadmap.version,
            )

        # -- 3c. FINAL STATE --------------------------------------------
        if user_signals:
            _hr(f"FINAL STATE: {uid}")
            print(f"  User vector drift: {m.get('knowledge_state_drift', 0):.4f}")
            print(f"  Signals absorbed: {len(state.strong_signals)}")
            print(f"  Weak topics: {state.weak_topics}")
            print(f"\n  Final Roadmap (v{roadmap.version}):")
            _print_roadmap(roadmap)
            print(f"\n  [Final Metrics] quality={m['roadmap_quality_score']:.3f}  "
                  f"reliability={m['signal_reliability']:.4f}  "
                  f"drift={m['knowledge_state_drift']:.4f}  "
                  f"coverage={m['topic_coverage']:.3f}")

    # -- 4. Summary ----------------------------------------------------
    _hr("PIPELINE RUN COMPLETE")
    print(f"  Users processed : {len(users)}")
    print(f"  Signals processed: {len(all_signals)}")
    print(f"  Topics available : {len(topics)}")
    print(f"  All data cleaned, transformed, and processed end-to-end.")
    print(f"  No Supabase required -- all state held in-memory.\n")


if __name__ == "__main__":
    main()
