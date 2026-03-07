"""
Async database client wrapper.
- When SUPABASE_URL and SUPABASE_KEY are set, uses the real Supabase client.
- Otherwise, falls back to an in-memory store so the API runs standalone.
"""

from __future__ import annotations

import json
from typing import Any, Optional
from datetime import datetime

from riqe.config import SUPABASE_URL, SUPABASE_KEY


# =====================================================================
# In-Memory Fallback (no Supabase needed)
# =====================================================================

class InMemoryDB:
    """Drop-in replacement that stores everything in dictionaries."""

    def __init__(self) -> None:
        self._states: dict[str, dict] = {}
        self._roadmaps: dict[str, list[dict]] = {}  # roadmap_id -> versions
        self._user_roadmaps: dict[str, list[str]] = {}  # user_id -> roadmap_ids
        self._signals: list[dict] = []
        self._metrics: dict[str, list[dict]] = {}  # user_id -> snapshots

    async def save_knowledge_state(self, user_id: str, state_data: dict[str, Any]) -> None:
        self._states[user_id] = {"user_id": user_id, **state_data}

    async def load_knowledge_state(self, user_id: str) -> Optional[dict[str, Any]]:
        return self._states.get(user_id)

    async def save_roadmap(self, roadmap_data: dict[str, Any]) -> None:
        rid = roadmap_data.get("roadmap_id", "unknown")
        uid = roadmap_data.get("user_id", "unknown")
        if rid not in self._roadmaps:
            self._roadmaps[rid] = []
        self._roadmaps[rid].append(roadmap_data)
        if uid not in self._user_roadmaps:
            self._user_roadmaps[uid] = []
        if rid not in self._user_roadmaps[uid]:
            self._user_roadmaps[uid].append(rid)

    async def load_roadmap(self, roadmap_id: str) -> Optional[dict[str, Any]]:
        versions = self._roadmaps.get(roadmap_id, [])
        if versions:
            return versions[-1]
        return None

    async def load_roadmap_history(self, roadmap_id: str) -> list[dict[str, Any]]:
        return list(reversed(self._roadmaps.get(roadmap_id, [])))

    async def load_current_roadmap_for_user(self, user_id: str) -> Optional[dict[str, Any]]:
        rids = self._user_roadmaps.get(user_id, [])
        if not rids:
            return None
        latest_rid = rids[-1]
        versions = self._roadmaps.get(latest_rid, [])
        return versions[-1] if versions else None

    async def save_signal(self, user_id: str, signal_data: dict[str, Any]) -> None:
        self._signals.append({"user_id": user_id, **signal_data})

    async def save_metrics(self, user_id: str, metrics_data: dict[str, Any]) -> None:
        if user_id not in self._metrics:
            self._metrics[user_id] = []
        self._metrics[user_id].append(metrics_data)

    async def load_metrics(self, user_id: str) -> list[dict[str, Any]]:
        return list(reversed(self._metrics.get(user_id, [])))


# =====================================================================
# Supabase Client (when credentials are available)
# =====================================================================

class SupabaseClient:
    """Singleton-style async wrapper around the Supabase Python client."""

    _instance: Optional["SupabaseClient"] = None
    _client = None

    def __new__(cls) -> "SupabaseClient":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def _ensure_client(self):
        if self._client is None:
            from supabase import create_client
            self._client = create_client(SUPABASE_URL, SUPABASE_KEY)
        return self._client

    @property
    def client(self):
        return self._ensure_client()

    async def save_knowledge_state(self, user_id: str, state_data: dict[str, Any]) -> None:
        payload = {"user_id": user_id, **state_data}
        self.client.table("knowledge_states").upsert(payload).execute()

    async def load_knowledge_state(self, user_id: str) -> Optional[dict[str, Any]]:
        resp = (
            self.client.table("knowledge_states")
            .select("*")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        return resp.data[0] if resp.data else None

    async def save_roadmap(self, roadmap_data: dict[str, Any]) -> None:
        self.client.table("roadmaps").insert(roadmap_data).execute()

    async def load_roadmap(self, roadmap_id: str) -> Optional[dict[str, Any]]:
        resp = (
            self.client.table("roadmaps")
            .select("*")
            .eq("roadmap_id", roadmap_id)
            .order("version", desc=True)
            .limit(1)
            .execute()
        )
        return resp.data[0] if resp.data else None

    async def load_roadmap_history(self, roadmap_id: str) -> list[dict[str, Any]]:
        resp = (
            self.client.table("roadmaps")
            .select("*")
            .eq("roadmap_id", roadmap_id)
            .order("version", desc=True)
            .execute()
        )
        return resp.data or []

    async def load_current_roadmap_for_user(self, user_id: str) -> Optional[dict[str, Any]]:
        resp = (
            self.client.table("roadmaps")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        return resp.data[0] if resp.data else None

    async def save_signal(self, user_id: str, signal_data: dict[str, Any]) -> None:
        payload = {"user_id": user_id, **signal_data}
        self.client.table("signals").insert(payload).execute()

    async def save_metrics(self, user_id: str, metrics_data: dict[str, Any]) -> None:
        payload = {"user_id": user_id, **metrics_data}
        self.client.table("metrics").insert(payload).execute()

    async def load_metrics(self, user_id: str) -> list[dict[str, Any]]:
        resp = (
            self.client.table("metrics")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )
        return resp.data or []


# =====================================================================
# Auto-select: use Supabase if creds exist, otherwise in-memory
# =====================================================================

if SUPABASE_URL and SUPABASE_KEY:
    db = SupabaseClient()
else:
    db = InMemoryDB()  # type: ignore[assignment]
