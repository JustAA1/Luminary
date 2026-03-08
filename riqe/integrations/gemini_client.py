"""
Gemini integration: ML pipeline output -> Gemini -> refined recommendations and roadmap.
Uses GEMINI_API_KEY from config (.env). Sends full pipeline context; Gemini returns
clear, helpful language and YouTube search queries for the frontend.
"""

from __future__ import annotations

import json
import urllib.request
import urllib.error
from typing import Any

from riqe.config import GEMINI_API_KEY

GEMINI_MODEL = "gemini-1.5-flash"
GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"


def _build_pipeline_summary(state: Any, roadmap: Any) -> str:
    """Build a rich text summary of pipeline state + roadmap for Gemini."""
    parts = []
    parts.append("=== USER KNOWLEDGE STATE (from ML pipeline) ===")
    parts.append(f"Completed topics (already mastered): {getattr(state, 'completed_topics', [])}")
    parts.append(f"Weak topics (need more practice): {getattr(state, 'weak_topics', [])}")
    strong = getattr(state, "strong_signals", [])
    if strong:
        parts.append("Recent learning signals (what the user has been engaging with):")
        for s in strong[-8:]:
            topic = getattr(s, "topic", "")
            strength = getattr(s, "strength", 0)
            sig_type = getattr(s, "signal_type", "")
            text_preview = (getattr(s, "text", "") or "")[:120]
            parts.append(f"  - {topic} (strength={strength:.2f}, type={sig_type}): \"{text_preview}...\"")

    parts.append("\n=== CURRENT ROADMAP (ordered by ML scores + prerequisites) ===")
    for i, node in enumerate(getattr(roadmap, "nodes", [])[:15], 1):
        tid = getattr(node, "topic_id", "")
        title = getattr(node, "title", tid)
        desc = getattr(node, "description", "")
        difficulty = getattr(node, "difficulty", 0)
        prereqs = getattr(node, "prerequisites", [])
        score = getattr(node, "recommendation_score", 0)
        parts.append(f"{i}. {tid}")
        parts.append(f"   Title: {title}")
        parts.append(f"   Description: {desc}")
        parts.append(f"   Difficulty: {difficulty:.0%}, Prerequisites: {prereqs}, Recommendation score: {score:.3f}")
    return "\n".join(parts)


def _call_gemini(prompt: str, api_key: str) -> str:
    """Call Gemini REST API; return response text or raise."""
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.35,
            "maxOutputTokens": 4096,
        },
    }
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        f"{GEMINI_URL}?key={api_key}",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=90) as resp:
            out = json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode() if e.fp else ""
        raise RuntimeError(f"Gemini API error {e.code}: {body}") from e
    except urllib.error.URLError as e:
        raise RuntimeError(f"Gemini request failed: {e}") from e

    try:
        candidates = out.get("candidates", [])
        if not candidates:
            return ""
        parts = candidates[0].get("content", {}).get("parts", [])
        if not parts:
            return ""
        return parts[0].get("text", "").strip()
    except (KeyError, IndexError):
        return ""


# Return type: topic_id -> {"suggestions": list[str], "youtube_queries": list[str]}
def generate_roadmap_items(state: Any, roadmap: Any) -> dict[str, dict[str, list[str]]]:
    """
    Send full pipeline state + roadmap to Gemini. Gemini refines language and returns
    per-topic suggestions and YouTube search queries.

    - suggestions: 2-4 clear, actionable items in friendly language (Next / Resource / Watch).
    - youtube_queries: 1-2 search phrases for YouTube (e.g. "Black-Scholes derivation tutorial")
      so the app can call the YouTube API and show videos.

    If GEMINI_API_KEY is not set, returns empty dict.
    """
    if not GEMINI_API_KEY:
        return {}

    summary = _build_pipeline_summary(state, roadmap)
    prompt = f"""You are a supportive learning coach for quantitative finance. The ML pipeline has produced the user's knowledge state and an ordered learning roadmap below. Your job is to turn this into clear, helpful recommendations the user can act on today.

Rules:
- Use refined, friendly language. Be specific and actionable. Avoid jargon unless the topic requires it; when you use terms, briefly clarify.
- For each roadmap topic, provide 2-4 short items. Use this format so the app can display them well:
  * "Next: [one concrete next step]"
  * "Resource: [book, chapter, or article suggestion]"
  * "Watch: [short YouTube search phrase]"  (this will be used for YouTube search - use 3-6 word phrases like "Ito lemma explained" or "GARCH volatility tutorial")
- Include at least one "Watch:" item per topic when it makes sense, so the user can use video learning.
- Tailor suggestions to the user: consider their completed topics (they already know these) and weak topics (they need practice). Use recent signals to personalize (e.g. if they mentioned Black-Scholes, suggest next steps that build on that).
- Return ONLY valid JSON. No markdown, no explanation. Format:
{{"topic_id_1": {{"suggestions": ["Next: ...", "Resource: ...", "Watch: ..."], "youtube_queries": ["search phrase 1", "search phrase 2"]}}, "topic_id_2": ...}}

Use the exact topic_id strings from the roadmap (e.g. "stochastic_calculus", "derivatives_pricing"). Include every topic that appears in the roadmap list below.

Input from ML pipeline:
{summary}

JSON output:"""

    try:
        text = _call_gemini(prompt, GEMINI_API_KEY)
    except Exception:
        return {}

    if not text:
        return {}

    text = text.strip()
    if "```" in text:
        for block in text.split("```"):
            block = block.strip()
            if block.startswith("json"):
                block = block[4:].strip()
            if block.startswith("{"):
                text = block
                break
    try:
        obj = json.loads(text)
        if not isinstance(obj, dict):
            return {}
        result = {}
        for tid, val in obj.items():
            if not isinstance(val, dict):
                result[tid] = {"suggestions": [], "youtube_queries": []}
                continue
            suggestions = val.get("suggestions") or val.get("items") or []
            youtube_queries = val.get("youtube_queries") or []
            if isinstance(suggestions, list):
                suggestions = [str(s) for s in suggestions[:6]]
            else:
                suggestions = []
            if isinstance(youtube_queries, list):
                youtube_queries = [str(q) for q in youtube_queries[:3]]
            else:
                youtube_queries = []
            result[tid] = {"suggestions": suggestions, "youtube_queries": youtube_queries}
        return result
    except json.JSONDecodeError:
        return {}


def attach_gemini_suggestions_to_roadmap(roadmap: Any, topic_to_data: dict[str, dict[str, list[str]]]) -> None:
    """
    Set suggestions and youtube_queries on each roadmap node from Gemini output.
    topic_to_data: topic_id -> {"suggestions": [...], "youtube_queries": [...]}
    """
    for node in getattr(roadmap, "nodes", []):
        tid = getattr(node, "topic_id", "")
        data = topic_to_data.get(tid, {})
        suggestions = data.get("suggestions", [])
        youtube_queries = data.get("youtube_queries", [])

        if hasattr(node, "suggestions"):
            node.suggestions = suggestions
        elif hasattr(node, "__dict__"):
            node.__dict__["suggestions"] = suggestions

        if hasattr(node, "youtube_queries"):
            node.youtube_queries = youtube_queries
        elif hasattr(node, "__dict__"):
            node.__dict__["youtube_queries"] = youtube_queries
