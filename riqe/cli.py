"""
RIQE CLI — run pipeline from stdin/stdout for local integration (e.g. Next.js API routes).
Reads one JSON object from stdin, runs onboard/signal/switch-roadmap, prints JSON to stdout.

Usage (one-shot; state is lost between runs):
  echo '{"action":"onboard","payload":{...}}' | python -m riqe.cli

Usage (daemon; one process, state kept between requests):
  python -m riqe.cli --daemon
  Then send one JSON object per line to stdin; one JSON response per line to stdout.
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
from datetime import datetime
from pathlib import Path

# Force in-memory DB when running as CLI (no Supabase required)
os.environ["SUPABASE_URL"] = os.environ.get("SUPABASE_URL", "")
os.environ["SUPABASE_KEY"] = os.environ.get("SUPABASE_KEY", "")

from riqe.core.pipeline import RIQEPipeline
from riqe.api.schemas import (
    OnboardRequest,
    SignalRequest,
    SwitchRoadmapRequest,
    OnboardResponse,
)
from riqe.app import _roadmap_to_schema, _state_to_schema


def _serialize(obj) -> str:
    """JSON-serialize response; handle datetime."""
    def default(o):
        if isinstance(o, datetime):
            return o.isoformat()
        raise TypeError(type(o).__name__)
    return json.dumps(obj, default=default)


async def _run(pipe: RIQEPipeline, req: dict) -> dict:
    action = req.get("action")
    payload = req.get("payload") or {}

    if action == "onboard":
        body = OnboardRequest(
            user_id=payload["user_id"],
            resume_text=payload.get("resume_text", ""),
            skill_scores=payload.get("skill_scores", {}),
            interests=payload.get("interests", []),
            field_of_study=payload.get("field_of_study", "quantitative_finance"),
            timeframe_weeks=payload.get("timeframe_weeks", 12),
            learning_history=payload.get("learning_history", []),
        )
        state, roadmap = await pipe.onboard(
            user_id=body.user_id,
            resume_text=body.resume_text,
            skill_scores=body.skill_scores,
            interests=body.interests,
            field_of_study=body.field_of_study,
            timeframe_weeks=body.timeframe_weeks,
            learning_history=[e.model_dump() for e in body.learning_history] or None,
        )
        out = OnboardResponse(
            state=_state_to_schema(state),
            roadmap=_roadmap_to_schema(roadmap),
        )
        return out.model_dump(mode="json")

    if action == "signal":
        body = SignalRequest(
            user_id=payload["user_id"],
            text=payload.get("text", ""),
        )
        roadmap = await pipe.process_text_input(body.user_id, body.text)
        out = _roadmap_to_schema(roadmap)
        return out.model_dump(mode="json")

    if action == "switch_roadmap":
        body = SwitchRoadmapRequest(
            user_id=payload["user_id"],
            new_roadmap_id=payload["new_roadmap_id"],
        )
        state, roadmap = await pipe.switch_roadmap(body.user_id, body.new_roadmap_id)
        out = OnboardResponse(
            state=_state_to_schema(state),
            roadmap=_roadmap_to_schema(roadmap),
        )
        return out.model_dump(mode="json")

    return {"error": f"Unknown action: {action}"}


def main() -> None:
    daemon = "--daemon" in sys.argv
    if daemon:
        async def loop() -> None:
            pipe = RIQEPipeline()
            pipe.metrics.set_total_topics(len(pipe.topics))
            while True:
                line = sys.stdin.readline()
                if not line:
                    break
                line = line.strip()
                if not line:
                    continue
                try:
                    req = json.loads(line)
                    result = await _run(pipe, req)
                    print(json.dumps(result), flush=True)
                except json.JSONDecodeError as e:
                    print(_serialize({"error": f"Invalid JSON: {e}"}), flush=True)
                except Exception as e:
                    print(_serialize({"error": str(e)}), flush=True)
        asyncio.run(loop())
        return
    # One-shot
    try:
        raw = sys.stdin.read()
        req = json.loads(raw)
    except json.JSONDecodeError as e:
        print(_serialize({"error": f"Invalid JSON: {e}"}), flush=True)
        sys.exit(1)
    try:
        pipe = RIQEPipeline()
        pipe.metrics.set_total_topics(len(pipe.topics))
        result = asyncio.run(_run(pipe, req))
        print(json.dumps(result), flush=True)
    except Exception as e:
        print(_serialize({"error": str(e)}), flush=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
