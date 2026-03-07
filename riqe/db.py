"""
Async Supabase client wrapper.
All database operations flow through this module — never inline Supabase calls.
"""

from __future__ import annotations

import json
from typing import Any, Optional

from supabase import create_client, Client

from riqe.config import SUPABASE_URL, SUPABASE_KEY


class SupabaseClient:
    """Singleton-style async wrapper around the Supabase Python client."""

    _instance: Optional["SupabaseClient"] = None
    _client: Optional[Client] = None

    def __new__(cls) -> "SupabaseClient":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def _ensure_client(self) -> Client:
        if self._client is None:
            if not SUPABASE_URL or not SUPABASE_KEY:
                raise RuntimeError(
                    "SUPABASE_URL and SUPABASE_KEY environment variables must be set."
                )
            self._client = create_client(SUPABASE_URL, SUPABASE_KEY)
        return self._client

    @property
    def client(self) -> Client:
        return self._ensure_client()

    # ── Knowledge State ───────────────────────────────────────────────

    async def save_knowledge_state(self, user_id: str, state_data: dict[str, Any]) -> None:
        """Upsert a knowledge state row for the given user."""
        payload = {"user_id": user_id, **state_data}
        self.client.table("knowledge_states").upsert(payload).execute()

    async def load_knowledge_state(self, user_id: str) -> Optional[dict[str, Any]]:
        """Load the latest knowledge state for a user."""
        resp = (
            self.client.table("knowledge_states")
            .select("*")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        if resp.data:
            return resp.data[0]
        return None

    # ── Roadmaps ──────────────────────────────────────────────────────

    async def save_roadmap(self, roadmap_data: dict[str, Any]) -> None:
        """Insert a new roadmap version."""
        self.client.table("roadmaps").insert(roadmap_data).execute()

    async def load_roadmap(self, roadmap_id: str) -> Optional[dict[str, Any]]:
        """Load the latest version of a roadmap."""
        resp = (
            self.client.table("roadmaps")
            .select("*")
            .eq("roadmap_id", roadmap_id)
            .order("version", desc=True)
            .limit(1)
            .execute()
        )
        if resp.data:
            return resp.data[0]
        return None

    async def load_roadmap_history(self, roadmap_id: str) -> list[dict[str, Any]]:
        """Load the full version history for a roadmap."""
        resp = (
            self.client.table("roadmaps")
            .select("*")
            .eq("roadmap_id", roadmap_id)
            .order("version", desc=True)
            .execute()
        )
        return resp.data or []

    async def load_current_roadmap_for_user(self, user_id: str) -> Optional[dict[str, Any]]:
        """Load the most recent roadmap for a user."""
        resp = (
            self.client.table("roadmaps")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        if resp.data:
            return resp.data[0]
        return None

    # ── Signals ───────────────────────────────────────────────────────

    async def save_signal(self, user_id: str, signal_data: dict[str, Any]) -> None:
        """Insert a signal record."""
        payload = {"user_id": user_id, **signal_data}
        self.client.table("signals").insert(payload).execute()

    # ── Metrics ───────────────────────────────────────────────────────

    async def save_metrics(self, user_id: str, metrics_data: dict[str, Any]) -> None:
        """Insert a metrics snapshot."""
        payload = {"user_id": user_id, **metrics_data}
        self.client.table("metrics").insert(payload).execute()

    async def load_metrics(self, user_id: str) -> list[dict[str, Any]]:
        """Load all metrics snapshots for a user."""
        resp = (
            self.client.table("metrics")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )
        return resp.data or []


# Module-level convenience instance
db = SupabaseClient()
