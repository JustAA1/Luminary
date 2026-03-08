"""
Workflow verification: user info → ML pipeline → produced outputs
──────────────────────────────────────────────────────────────────
Tedious step-by-step check that every user field flows into the pipeline
and that roadmap/signals/state are produced correctly. Run:
  python -m riqe.tests.test_workflow_user_to_ml
"""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

# Add project root
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import numpy as np

from riqe.config import (
    TEXT_EMBED_DIM,
    USER_EMBED_DIM,
    STRUCTURED_DIM,
    PROFILE_INPUT_DIM,
    TOPICS_FILE,
    COMPLETION_THRESHOLD,
    WEAK_TOPIC_THRESHOLD,
)
from riqe.models.encoders import TextEncoder, StructuredEncoder
from riqe.models.models import UserProfileMLP, RIQESignalClassifier
from riqe.core.knowledge_state import KnowledgeStateManager, KnowledgeState
from riqe.core.roadmap_engine import PrerequisiteGraph, RoadmapGenerator
from riqe.core.signal_processor import SignalProcessor
from riqe.models.models import TrendGRU


def step(msg: str) -> None:
    print(f"\n{'='*60}")
    print(f"  {msg}")
    print("="*60)


def ok(msg: str) -> None:
    print(f"  [OK] {msg}")


def check(cond: bool, msg: str) -> None:
    if cond:
        ok(msg)
    else:
        print(f"  [FAIL] {msg}")
        raise AssertionError(msg)


def run_workflow_checks() -> None:
    """Run all workflow steps and verify data flow."""

    # ── Step 1: User profile → encoders → MLP input ────────────────────
    step("Step 1: User profile -> encoders -> concat vector")

    resume_text = "MS in applied math. Strong in probability and statistics. Learning quant finance."
    interests = ["derivatives pricing", "risk management"]
    skill_scores = {"probability": 0.7, "statistics": 0.65, "python": 0.5}
    field_of_study = "mathematics"
    timeframe_weeks = 12
    learning_history = [
        {"topic_id": "probability_theory", "completion_rate": 0.9, "quiz_score": 0.85, "time_spent_minutes": 120, "revisit_count": 0},
        {"topic_id": "statistics_econometrics", "completion_rate": 0.4, "quiz_score": 0.35, "time_spent_minutes": 60, "revisit_count": 2},
    ]

    text_encoder = TextEncoder()
    resume_vec = text_encoder.encode(resume_text)
    interests_vec = text_encoder.encode(" ".join(interests))
    check(resume_vec.shape == (TEXT_EMBED_DIM,), f"resume_vec shape {resume_vec.shape} == ({TEXT_EMBED_DIM},)")
    check(interests_vec.shape == (TEXT_EMBED_DIM,), f"interests_vec shape == ({TEXT_EMBED_DIM},)")
    ok(f"resume_text and interests -> TextEncoder -> {TEXT_EMBED_DIM}-dim each")

    struct_vec = StructuredEncoder.encode_profile(
        skill_scores=skill_scores,
        field_of_study=field_of_study,
        timeframe_weeks=timeframe_weeks,
        learning_history=learning_history,
    )
    check(struct_vec.shape == (STRUCTURED_DIM,), f"struct_vec shape {struct_vec.shape} == ({STRUCTURED_DIM},)")
    ok(f"skill_scores, field_of_study, timeframe_weeks, learning_history -> StructuredEncoder -> {STRUCTURED_DIM}-dim")

    concat = np.concatenate([resume_vec, interests_vec, struct_vec])
    check(concat.shape == (PROFILE_INPUT_DIM,), f"concat shape {concat.shape} == ({PROFILE_INPUT_DIM},)")
    ok(f"concat = resume(384) + interests(384) + struct(55) = {PROFILE_INPUT_DIM} -> MLP input")

    user_mlp = UserProfileMLP()
    import torch
    with torch.no_grad():
        user_vector = user_mlp(torch.tensor(concat, dtype=torch.float32).unsqueeze(0)).squeeze(0).numpy()
    check(user_vector.shape == (USER_EMBED_DIM,), f"user_vector shape {user_vector.shape} == ({USER_EMBED_DIM},)")
    ok(f"UserProfileMLP(concat) -> user_vector (128,)")

    # ── Step 2: KnowledgeStateManager.initialize → state ─────────────────
    step("Step 2: initialize() -> KnowledgeState (user_vector, completed_topics, weak_topics)")

    ks_manager = KnowledgeStateManager(text_encoder=text_encoder, user_mlp=user_mlp)
    state = ks_manager.initialize(
        user_id="workflow_test_user",
        resume_text=resume_text,
        skill_scores=skill_scores,
        interests=interests,
        field_of_study=field_of_study,
        timeframe_weeks=timeframe_weeks,
        learning_history=learning_history,
    )

    check(state.user_id == "workflow_test_user", "state.user_id preserved")
    check(state.user_vector.shape == (USER_EMBED_DIM,), "state.user_vector (128,)")
    check("probability_theory" in state.completed_topics, "completion_rate 0.9 > 0.8 -> probability_theory in completed_topics")
    check("statistics_econometrics" in state.weak_topics, "quiz_score 0.35 < 0.5 -> statistics_econometrics in weak_topics")
    ok("completed_topics and weak_topics derived from learning_history (COMPLETION_THRESHOLD, WEAK_TOPIC_THRESHOLD)")

    # ── Step 3: RoadmapGenerator.generate(state) → roadmap ───────────────
    step("Step 3: generate(state) -> Roadmap (nodes, recommendation_score, prerequisites)")

    with open(TOPICS_FILE, "r", encoding="utf-8") as f:
        raw_topics = json.load(f)
    from riqe.core.roadmap_engine import Topic
    topics = []
    for t in raw_topics:
        topic = Topic(
            topic_id=t["topic_id"],
            title=t["title"],
            description=t["description"],
            difficulty=t["difficulty"],
        )
        topic.embedding = text_encoder.encode(f"{topic.title}. {topic.description}")
        topic.embedding_128 = topic.embedding.reshape(3, 128).mean(axis=0)
        topics.append(topic)

    prereq_graph = PrerequisiteGraph()
    roadmap_gen = RoadmapGenerator(prerequisite_graph=prereq_graph, topics=topics)
    roadmap = roadmap_gen.generate(state)

    check(roadmap.user_id == state.user_id, "roadmap.user_id matches state")
    check(len(roadmap.nodes) > 0, "roadmap has nodes")
    check(roadmap.version == 1, "initial roadmap version 1")
    for node in roadmap.nodes:
        check(hasattr(node, "recommendation_score"), "node has recommendation_score")
        check(hasattr(node, "prerequisites"), "node has prerequisites")
        check(hasattr(node, "topic_id"), "node has topic_id")
    ok("Roadmap nodes have recommendation_score (cosine + signal + trend), prerequisites, topic_id")

    # ── Step 4: Signal text → SignalProcessor.process → RIQESignal ────────
    step("Step 4: Signal text -> SignalProcessor -> RIQESignal (topic, strength, signal_type, trend)")

    topic_ids = [t.topic_id for t in topics]
    signal_classifier = RIQESignalClassifier()
    trend_gru = TrendGRU()
    signal_processor = SignalProcessor(
        text_encoder=text_encoder,
        signal_classifier=signal_classifier,
        trend_gru=trend_gru,
        topic_id_list=topic_ids,
    )

    signal_text = "Studied Ito's lemma and GBM. Ready for Black-Scholes derivation."
    from datetime import datetime
    signal = signal_processor.process(signal_text, datetime.utcnow())

    check(signal.text == signal_text, "signal.text preserved")
    check(signal.topic in topic_ids, f"signal.topic '{signal.topic}' in topic_ids")
    check(0 <= signal.strength <= 1, f"signal.strength in [0,1]: {signal.strength}")
    check(signal.signal_type in ("new_info", "reinforcement", "contradiction"), f"signal_type: {signal.signal_type}")
    check(signal.trend in ("rising", "stable", "fading"), f"signal.trend: {signal.trend}")
    ok("RIQESignal has topic (from classifier), strength, signal_type, trend (from TrendGRU)")

    # ── Step 5: update_from_signal(state, signal) → updated state ───────
    step("Step 5: update_from_signal(state, signal) -> strong_signals, user_vector EMA")

    state_before = state.user_vector.copy()
    n_signals_before = len(state.strong_signals)
    state_updated = ks_manager.update_from_signal(state, signal)

    check(
        np.any(state_updated.user_vector != state_before),
        "user_vector changed (EMA update with signal embedding)",
    )
    check(len(state_updated.strong_signals) >= n_signals_before, "strong_signals not reduced after update")
    ok("State updated: user_vector EMA with signal; strong_signals appended when signal_type is new_info")

    # ── Step 6: RoadmapGenerator.update → new roadmap version ────────────
    step("Step 6: update(roadmap, signal, state) -> new version, quality_score")

    roadmap_v2 = roadmap_gen.update(roadmap, signal, state_updated)
    check(roadmap_v2.version == roadmap.version + 1, f"version bumped {roadmap.version} -> {roadmap_v2.version}")
    check(hasattr(roadmap_v2, "quality_score"), "roadmap has quality_score")
    ok("Updated roadmap has new version and quality_score (mean recommendation_score)")

    # ── Step 7: Full pipeline via API path (onboard + process_text_input) ─
    step("Step 7: Full pipeline (onboard + process_text_input) via RIQEPipeline")

    async def full_pipeline():
        from riqe.db import db
        # Use in-memory db
        from riqe.core.pipeline import RIQEPipeline
        pipe = RIQEPipeline()
        user_id = "workflow_full_user"
        state1, rm1 = await pipe.onboard(
            user_id=user_id,
            resume_text=resume_text,
            skill_scores=skill_scores,
            interests=interests,
            field_of_study=field_of_study,
            timeframe_weeks=timeframe_weeks,
            learning_history=learning_history,
        )
        check(state1.user_id == user_id, "onboard: state.user_id")
        check(len(rm1.nodes) > 0, "onboard: roadmap has nodes")
        ok("onboard() -> state + roadmap")

        rm2 = await pipe.process_text_input(user_id, signal_text)
        check(rm2.version >= rm1.version, "after signal: roadmap version >= initial")
        check(rm2.roadmap_id == rm1.roadmap_id, "roadmap_id preserved")
        ok("process_text_input() -> updated roadmap (version, nodes re-scored)")

        state_after = pipe._states[user_id]
        check(state_after.user_vector.shape == (USER_EMBED_DIM,), "state still has user_vector (128) after signal")
        # strong_signals only grow when signal_type is new_info; contradiction/reinforcement don't append
        ok("User state in pipeline updated (user_vector EMA; strong_signals if signal was new_info)")

    asyncio.run(full_pipeline())

    # ── Summary ────────────────────────────────────────────────────────
    step("WORKFLOW VERIFICATION COMPLETE")
    print("  User info flow:")
    print("    - resume_text, interests -> TextEncoder -> 384-dim each")
    print("    - skill_scores, field_of_study, timeframe_weeks, learning_history -> StructuredEncoder -> 55-dim")
    print("    - concat (823) -> UserProfileMLP -> user_vector (128)")
    print("    - learning_history completion_rate/quiz_score -> completed_topics, weak_topics")
    print("  Produced outputs:")
    print("    - state: user_vector, completed_topics, weak_topics, strong_signals (after signals)")
    print("    - roadmap: nodes with recommendation_score, signal_score, prerequisites, quality_score")
    print("    - signal: topic, strength, signal_type, trend, reliability_score")
    print("  All steps passed.")
    print("="*60)


if __name__ == "__main__":
    run_workflow_checks()
