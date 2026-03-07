"""
RIQE API Schemas
────────────────
Pydantic v2 models for all API request / response shapes.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# ═══════════════════════════════════════════════════════════════════════
# Sub-models
# ═══════════════════════════════════════════════════════════════════════

class LearningEventSchema(BaseModel):
    """A single historical learning event."""
    topic_id: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    completion_rate: float = Field(ge=0.0, le=1.0)
    quiz_score: float = Field(ge=0.0, le=1.0)
    time_spent_minutes: int = Field(ge=0)
    revisit_count: int = Field(ge=0, default=0)


class UserProfileSchema(BaseModel):
    """Complete user profile for onboarding."""
    user_id: str
    resume_text: str
    skill_scores: dict[str, float]
    interests: list[str]
    field_of_study: str
    timeframe_weeks: int = Field(ge=1)
    learning_history: list[LearningEventSchema] = Field(default_factory=list)


class RIQESignalSchema(BaseModel):
    """Classified signal from text input."""
    text: str
    timestamp: datetime
    topic: str
    strength: float = Field(ge=0.0, le=1.0)
    is_new_info: bool
    trend: str  # rising | stable | fading
    reliability_score: float
    signal_type: str = "new_info"


class RoadmapNodeSchema(BaseModel):
    """A single node in the roadmap."""
    topic_id: str
    title: str
    description: str
    difficulty: float
    prerequisites: list[str]
    recommendation_score: float
    signal_score: float
    confidence: float


class RoadmapSchema(BaseModel):
    """Full roadmap with ordered nodes."""
    roadmap_id: str
    user_id: str
    nodes: list[RoadmapNodeSchema]
    created_at: datetime
    version: int = 1
    quality_score: float = 0.0


class KnowledgeStateSchema(BaseModel):
    """Serialisable knowledge state."""
    user_id: str
    user_vector: list[float]
    completed_topics: list[str] = Field(default_factory=list)
    weak_topics: list[str] = Field(default_factory=list)
    strong_signals: list[RIQESignalSchema] = Field(default_factory=list)


class RoadmapSessionSchema(BaseModel):
    """One roadmap session with history."""
    session_id: str
    roadmap_id: str
    signals_received: list[RIQESignalSchema] = Field(default_factory=list)
    roadmap_versions: list[RoadmapSchema] = Field(default_factory=list)
    final_quality_delta: float = 0.0


# ═══════════════════════════════════════════════════════════════════════
# Request Bodies
# ═══════════════════════════════════════════════════════════════════════

class OnboardRequest(BaseModel):
    """POST /onboard request body."""
    user_id: str
    resume_text: str
    skill_scores: dict[str, float]
    interests: list[str]
    field_of_study: str
    timeframe_weeks: int = Field(ge=1)
    learning_history: list[LearningEventSchema] = Field(default_factory=list)


class SignalRequest(BaseModel):
    """POST /signal request body."""
    user_id: str
    text: str


class SwitchRoadmapRequest(BaseModel):
    """POST /switch-roadmap request body."""
    user_id: str
    new_roadmap_id: str


# ═══════════════════════════════════════════════════════════════════════
# Response Bodies
# ═══════════════════════════════════════════════════════════════════════

class OnboardResponse(BaseModel):
    """POST /onboard response."""
    state: KnowledgeStateSchema
    roadmap: RoadmapSchema


class RoadmapHistoryResponse(BaseModel):
    """GET /roadmap/{roadmap_id}/history response."""
    roadmap_id: str
    versions: list[RoadmapSchema]


class MetricsResponse(BaseModel):
    """GET /metrics/{user_id} response."""
    user_id: str
    metrics: list[dict]
