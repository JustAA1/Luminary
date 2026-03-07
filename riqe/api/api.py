"""
RIQE FastAPI Application
────────────────────────
REST endpoints that expose the full RIQE pipeline.
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, HTTPException

from riqe.api.schemas import (
    OnboardRequest,
    OnboardResponse,
    SignalRequest,
    SwitchRoadmapRequest,
    RoadmapSchema,
    KnowledgeStateSchema,
    RoadmapHistoryResponse,
    RoadmapNodeSchema,
    RIQESignalSchema,
    MetricsResponse,
)
from riqe.core.pipeline import RIQEPipeline
from riqe.db import db


# ═══════════════════════════════════════════════════════════════════════
# Lifespan — initialise the pipeline once at startup
# ═══════════════════════════════════════════════════════════════════════

pipeline: RIQEPipeline | None = None


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    global pipeline
    pipeline = RIQEPipeline()
    pipeline.metrics.set_total_topics(len(pipeline.topics))
    yield


app = FastAPI(
    title="RIQE — Reliable Intelligence Query Engine",
    version="0.1.0",
    lifespan=lifespan,
)


def _get_pipeline() -> RIQEPipeline:
    if pipeline is None:
        raise HTTPException(503, "Pipeline not initialised yet")
    return pipeline


# ═══════════════════════════════════════════════════════════════════════
# Helper converters
# ═══════════════════════════════════════════════════════════════════════

def _roadmap_to_schema(rm) -> RoadmapSchema:
    """Convert internal Roadmap dataclass → Pydantic schema."""
    return RoadmapSchema(
        roadmap_id=rm.roadmap_id,
        user_id=rm.user_id,
        nodes=[
            RoadmapNodeSchema(
                topic_id=n.topic_id,
                title=n.title,
                description=n.description,
                difficulty=n.difficulty,
                prerequisites=n.prerequisites,
                recommendation_score=n.recommendation_score,
                signal_score=n.signal_score,
                confidence=n.confidence,
            )
            for n in rm.nodes
        ],
        created_at=rm.created_at,
        version=rm.version,
        quality_score=rm.quality_score,
    )


def _state_to_schema(state) -> KnowledgeStateSchema:
    """Convert internal KnowledgeState → Pydantic schema."""
    return KnowledgeStateSchema(
        user_id=state.user_id,
        user_vector=state.user_vector.tolist(),
        completed_topics=state.completed_topics,
        weak_topics=state.weak_topics,
        strong_signals=[
            RIQESignalSchema(
                text=s.text,
                timestamp=s.timestamp,
                topic=s.topic,
                strength=s.strength,
                is_new_info=s.is_new_info,
                trend=s.trend,
                reliability_score=s.reliability_score,
                signal_type=s.signal_type,
            )
            for s in state.strong_signals
        ],
    )


# ═══════════════════════════════════════════════════════════════════════
# Endpoints
# ═══════════════════════════════════════════════════════════════════════

@app.post("/onboard", response_model=OnboardResponse)
async def onboard(req: OnboardRequest) -> OnboardResponse:
    """Create initial knowledge state and generate a personalised roadmap."""
    pipe = _get_pipeline()
    learning_hist = [evt.model_dump() for evt in req.learning_history]

    state, roadmap = await pipe.onboard(
        user_id=req.user_id,
        resume_text=req.resume_text,
        skill_scores=req.skill_scores,
        interests=req.interests,
        field_of_study=req.field_of_study,
        timeframe_weeks=req.timeframe_weeks,
        learning_history=learning_hist or None,
    )

    return OnboardResponse(
        state=_state_to_schema(state),
        roadmap=_roadmap_to_schema(roadmap),
    )


@app.post("/signal", response_model=RoadmapSchema)
async def process_signal(req: SignalRequest) -> RoadmapSchema:
    """Ingest a text signal and return the updated roadmap."""
    pipe = _get_pipeline()
    try:
        roadmap = await pipe.process_text_input(req.user_id, req.text)
    except ValueError as exc:
        raise HTTPException(404, str(exc))
    return _roadmap_to_schema(roadmap)


@app.post("/switch-roadmap", response_model=OnboardResponse)
async def switch_roadmap(req: SwitchRoadmapRequest) -> OnboardResponse:
    """Transfer knowledge state to a new roadmap context."""
    pipe = _get_pipeline()
    try:
        state, roadmap = await pipe.switch_roadmap(
            req.user_id, req.new_roadmap_id
        )
    except ValueError as exc:
        raise HTTPException(404, str(exc))
    return OnboardResponse(
        state=_state_to_schema(state),
        roadmap=_roadmap_to_schema(roadmap),
    )


@app.get("/state/{user_id}", response_model=KnowledgeStateSchema)
async def get_state(user_id: str) -> KnowledgeStateSchema:
    """Retrieve the current knowledge state for a user."""
    pipe = _get_pipeline()
    try:
        state = await pipe._ensure_state(user_id)
    except ValueError as exc:
        raise HTTPException(404, str(exc))
    return _state_to_schema(state)


@app.get("/roadmap/{roadmap_id}/history", response_model=RoadmapHistoryResponse)
async def roadmap_history(roadmap_id: str) -> RoadmapHistoryResponse:
    """Retrieve all versions of a roadmap and their quality scores."""
    rows = await db.load_roadmap_history(roadmap_id)
    if not rows:
        raise HTTPException(404, f"No roadmap found with id {roadmap_id}")

    # Build lightweight schemas from DB rows
    versions: list[RoadmapSchema] = []
    for row in rows:
        versions.append(
            RoadmapSchema(
                roadmap_id=row["roadmap_id"],
                user_id=row["user_id"],
                nodes=[RoadmapNodeSchema(**n) for n in row.get("nodes", [])],
                created_at=row["created_at"],
                version=row.get("version", 1),
                quality_score=row.get("quality_score", 0.0),
            )
        )

    return RoadmapHistoryResponse(roadmap_id=roadmap_id, versions=versions)


@app.get("/metrics/{user_id}", response_model=MetricsResponse)
async def get_metrics(user_id: str) -> MetricsResponse:
    """Return all MLflow-logged metrics snapshots for a user."""
    rows = await db.load_metrics(user_id)
    return MetricsResponse(user_id=user_id, metrics=rows)
