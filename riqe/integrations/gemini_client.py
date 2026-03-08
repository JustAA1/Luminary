"""
Gemini integration: 4-phase pipeline
─────────────────────────────────────
Phase 2: generate_topic_outline   — user context + prompt → topic list with subtopics
Phase 4: generate_roadmap_items   — ML scores + user context → refined suggestions, youtube, why_this

Uses GEMINI_API_KEY from config (.env).
"""

from __future__ import annotations

import json
import urllib.request
import urllib.error
from typing import Any, Optional

from riqe.config import OPENAI_API_KEY


# ═══════════════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════════════

def _call_gemini(prompt: str, api_key: str, temperature: float = 0.35, max_tokens: int = 4096) -> str:
    """Call OpenAI REST API with retry on 429; return response text or raise."""
    import sys
    import time

    payload = {
        "model": "gpt-4o",
        "messages": [{"role": "user", "content": prompt}],
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    data = json.dumps(payload).encode("utf-8")

    max_retries = 3
    for attempt in range(max_retries + 1):
        req = urllib.request.Request(
            "https://api.openai.com/v1/chat/completions",
            data=data,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}"
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=90) as resp:
                out = json.loads(resp.read().decode())
            break  # success
        except urllib.error.HTTPError as e:
            body = e.read().decode() if e.fp else ""
            if e.code == 429 and attempt < max_retries:
                wait = 2 ** (attempt + 1)  # 2s, 4s, 8s
                print(f"RIQE OpenAI: 429 rate limited, retry {attempt+1}/{max_retries} in {wait}s", file=sys.stderr, flush=True)
                time.sleep(wait)
                continue
            raise RuntimeError(f"OpenAI API error {e.code}: {body}") from e
        except urllib.error.URLError as e:
            raise RuntimeError(f"OpenAI request failed: {e}") from e
    else:
        raise RuntimeError("OpenAI API: max retries exceeded (429)")

    try:
        choices = out.get("choices", [])
        if not choices:
            return ""
        return choices[0].get("message", {}).get("content", "").strip()
    except (KeyError, IndexError):
        return ""


def _extract_json(text: str) -> dict:
    """Extract JSON from Gemini response (handles ```json fences)."""
    text = text.strip()
    if "```" in text:
        for block in text.split("```"):
            block = block.strip()
            if block.startswith("json"):
                block = block[4:].strip()
            if block.startswith("{") or block.startswith("["):
                text = block
                break
    return json.loads(text)


def _build_user_context_summary(user_profile: Optional[dict], state: Any) -> str:
    """Build a rich text summary of the user from Supabase profile + ML knowledge state."""
    parts = []

    # Supabase profile data
    if user_profile:
        parts.append("=== USER PROFILE (from database) ===")
        if user_profile.get("full_name"):
            parts.append(f"Name: {user_profile['full_name']}")
        skills = user_profile.get("skills_gained") or {}
        if skills:
            skill_strs = [f"{k}: {v}" for k, v in skills.items() if v]
            parts.append(f"Skills: {', '.join(skill_strs)}")
        courses = user_profile.get("courses_active") or []
        if courses:
            parts.append(f"Active courses: {courses}")
        coursework = user_profile.get("past_coursework") or []
        if coursework:
            cw_strs = []
            for cw in coursework[:8]:
                if isinstance(cw, dict):
                    cw_strs.append(f"{cw.get('course', cw.get('name', str(cw)))}")
                else:
                    cw_strs.append(str(cw))
            parts.append(f"Past coursework: {', '.join(cw_strs)}")
        hours = user_profile.get("hours_learned") or user_profile.get("total_hours")
        if hours:
            parts.append(f"Total learning hours: {hours}")

    # ML knowledge state
    parts.append("\n=== KNOWLEDGE STATE (from ML pipeline) ===")
    parts.append(f"Completed topics (mastered): {getattr(state, 'completed_topics', [])}")
    parts.append(f"Weak topics (need practice): {getattr(state, 'weak_topics', [])}")
    strong = getattr(state, "strong_signals", [])
    if strong:
        parts.append("Recent learning signals:")
        for s in strong[-8:]:
            topic = getattr(s, "topic", "")
            strength = getattr(s, "strength", 0)
            sig_type = getattr(s, "signal_type", "")
            text_preview = (getattr(s, "text", "") or "")[:120]
            parts.append(f"  - {topic} (strength={strength:.2f}, type={sig_type}): \"{text_preview}\"")

    return "\n".join(parts)


# ═══════════════════════════════════════════════════════════════════════
# Phase 2: Topic Outline Generation
# ═══════════════════════════════════════════════════════════════════════

def generate_topic_outline(
    user_profile: Optional[dict],
    state: Any,
    prompt: str,
    existing_topic_ids: list[str],
) -> list[dict[str, Any]]:
    """
    Phase 2: Send user context + prompt to Gemini → get a topic outline.

    Returns a list of dicts:
    [{"topic_id": "...", "title": "...", "description": "...", "difficulty": 0.5, "prerequisites": [...]}]

    If OPENAI_API_KEY is not set or Gemini fails, returns empty list (pipeline falls back to static topics).
    """
    if not OPENAI_API_KEY:
        return []

    user_context = _build_user_context_summary(user_profile, state)

    gemini_prompt = f"""You are an expert curriculum designer with a strong background in quantitative finance. Given a user's profile and their request, generate a personalized learning roadmap outline.

IMPORTANT: The core of the roadmap MUST match the user's request. If they ask about machine learning, generate ML topics. If they ask about history, generate history topics.
HOWEVER, you must always try to weave in quantitative finance, data analysis, or mathematical modeling where applicable. Introduce 1-3 topics that connect their requested subject to quantitative methods, financial applications, or risk modeling. Show them how quant finance concepts intersect with their interests!

{user_context}

User's request/context: "{prompt if prompt else 'Generate a comprehensive learning roadmap based on my profile'}"

Existing topic IDs in the system (you can reference these or create new ones):
{existing_topic_ids[:30]}

Instructions:
- Generate 8-15 topics that form a coherent learning path SPECIFICALLY for what the user requested
- Each topic should have a snake_case topic_id, a clear title, a 1-2 sentence description, a difficulty score (0.0 to 1.0), and a list of prerequisite topic_ids
- Order from foundational to advanced
- Tailor to the user's existing skills and interests
- Focus on the specific subject area the user mentioned, but INJECT quantitative/financial perspectives or applications where possible.
- Mix theoretical foundations with practical applications
- Create new topic_ids for the user's requested subject if existing ones don't match

Return ONLY valid JSON array. No markdown, no explanation:
[{{"topic_id": "snake_case_id", "title": "Human Readable Title", "description": "What this covers...", "difficulty": 0.4, "prerequisites": ["prereq_id"]}}]

JSON output:"""

    import sys

    try:
        text = _call_gemini(gemini_prompt, OPENAI_API_KEY, temperature=0.4, max_tokens=4096)
    except Exception as e:
        print(f"RIQE P2-detail: Gemini API call FAILED: {e}", file=sys.stderr, flush=True)
        return []

    if not text:
        print("RIQE P2-detail: Gemini returned empty text", file=sys.stderr, flush=True)
        return []

    print(f"RIQE P2-detail: Gemini raw response ({len(text)} chars): {text[:300]}...", file=sys.stderr, flush=True)

    try:
        result = _extract_json(text)
        if isinstance(result, list):
            # Validate and clean
            clean = []
            for item in result:
                if not isinstance(item, dict):
                    continue
                clean.append({
                    "topic_id": str(item.get("topic_id", f"topic_{len(clean)}")),
                    "title": str(item.get("title", "")),
                    "description": str(item.get("description", "")),
                    "difficulty": float(item.get("difficulty", 0.5)),
                    "prerequisites": list(item.get("prerequisites", [])),
                })
            print(f"RIQE P2-detail: Parsed {len(clean)} topics from Gemini JSON", file=sys.stderr, flush=True)
            return clean
        else:
            print(f"RIQE P2-detail: _extract_json returned non-list type: {type(result)}", file=sys.stderr, flush=True)
    except (json.JSONDecodeError, ValueError, TypeError) as e:
        print(f"RIQE P2-detail: JSON parse FAILED: {e}, raw text: {text[:200]}", file=sys.stderr, flush=True)

    return []


# ═══════════════════════════════════════════════════════════════════════
# Phase 4: ML-Informed Refinement
# ═══════════════════════════════════════════════════════════════════════

def _build_pipeline_summary(state: Any, roadmap: Any, user_profile: Optional[dict] = None) -> str:
    """Build a rich text summary of pipeline state + roadmap + user context for Gemini Phase 4."""
    parts = []

    # Include user context
    if user_profile:
        parts.append(_build_user_context_summary(user_profile, state))
    else:
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
                parts.append(f"  - {topic} (strength={strength:.2f}, type={sig_type}): \"{text_preview}\"")

    parts.append("\n=== ROADMAP (ordered by ML scores + prerequisites) ===")
    for i, node in enumerate(getattr(roadmap, "nodes", [])[:15], 1):
        tid = getattr(node, "topic_id", "")
        title = getattr(node, "title", tid)
        desc = getattr(node, "description", "")
        difficulty = getattr(node, "difficulty", 0)
        prereqs = getattr(node, "prerequisites", [])
        rec_score = getattr(node, "recommendation_score", 0)
        sig_score = getattr(node, "signal_score", 0)
        confidence = getattr(node, "confidence", 0)
        parts.append(f"{i}. {tid}")
        parts.append(f"   Title: {title}")
        parts.append(f"   Description: {desc}")
        parts.append(f"   Difficulty: {difficulty:.0%}, Prerequisites: {prereqs}")
        parts.append(f"   ML Scores → recommendation: {rec_score:.3f}, signal: {sig_score:.3f}, confidence: {confidence:.3f}")
    return "\n".join(parts)


def generate_roadmap_items(
    state: Any,
    roadmap: Any,
    user_profile: Optional[dict] = None,
) -> dict[str, dict[str, Any]]:
    """
    Phase 4: Send ML-scored roadmap + user context to Gemini for language refinement.

    Now receives ML scores (recommendation_score, signal_score, confidence) and uses them
    to generate more accurate and personalized suggestions, youtube_queries, and why_this.

    Returns: topic_id → {"suggestions": [...], "youtube_queries": [...], "why_this": "..."}
    """
    if not OPENAI_API_KEY:
        return {}

    summary = _build_pipeline_summary(state, roadmap, user_profile)
    prompt = f"""You are a supportive learning coach. The ML pipeline has scored and ordered a personalized roadmap for this user. You have access to their full profile, knowledge state, and the ML scores for each topic.

Your job: turn the ML output into clear, personalized recommendations the user can act on today.

Rules:
- Be specific and actionable. Reference the user's actual skills, courses, and learning history when possible.
- For each topic, provide 2-4 short items:
  * "Next: [one concrete next step]"
  * "Resource: [book, chapter, or article suggestion]"
  * "Watch: [YouTube search phrase - 3-6 words]"
- Include at least one "Watch:" item per topic.
- Use the ML scores to calibrate your language:
  * High recommendation_score (>0.5) → emphasize strong relevance to user's profile
  * High signal_score (>0.3) → note the user's recent engagement with related topics
  * Low confidence (<0.5) → suggest the user explore this area to help the system learn their preferences
  * High difficulty (>0.6) → recommend foundational prep and more time
- For "why_this": write a personalized 2-3 sentence explanation of why THIS topic matters for THIS user. Reference their specific skills, interests, completed topics, and career goals. Use the ML scores to justify placement. Examples:
  * "Your strong programming background (0.75) combined with rising interest in volatility modeling makes stochastic calculus the natural next step. The ML pipeline scored this at 82% relevance because it unlocks advanced derivatives pricing."
  * "Since you've completed probability theory and your signal score shows active engagement with risk topics, Value at Risk is perfectly positioned in your path."

Return ONLY valid JSON. No markdown, no explanation. Format:
{{"topic_id_1": {{"suggestions": ["Next: ...", "Resource: ...", "Watch: ..."], "youtube_queries": ["search phrase 1", "search phrase 2"], "why_this": "Personalized explanation referencing ML scores and user profile..."}}, "topic_id_2": ...}}

Use the exact topic_id strings from the roadmap. Include every topic.

Input from ML pipeline + user profile:
{summary}

JSON output:"""

    try:
        text = _call_gemini(prompt, OPENAI_API_KEY, temperature=0.35, max_tokens=6144)
    except Exception:
        return {}

    if not text:
        return {}

    try:
        obj = _extract_json(text)
        if not isinstance(obj, dict):
            return {}
        result = {}
        for tid, val in obj.items():
            if not isinstance(val, dict):
                result[tid] = {"suggestions": [], "youtube_queries": [], "why_this": ""}
                continue
            suggestions = val.get("suggestions") or val.get("items") or []
            youtube_queries = val.get("youtube_queries") or []
            why_this = val.get("why_this") or ""
            if isinstance(suggestions, list):
                suggestions = [str(s) for s in suggestions[:6]]
            else:
                suggestions = []
            if isinstance(youtube_queries, list):
                youtube_queries = [str(q) for q in youtube_queries[:3]]
            else:
                youtube_queries = []
            if not isinstance(why_this, str):
                why_this = str(why_this) if why_this else ""
            result[tid] = {"suggestions": suggestions, "youtube_queries": youtube_queries, "why_this": why_this}
        return result
    except (json.JSONDecodeError, ValueError, TypeError):
        return {}


def attach_gemini_suggestions_to_roadmap(roadmap: Any, topic_to_data: dict[str, dict[str, Any]]) -> None:
    """
    Set suggestions, youtube_queries, and why_this on each roadmap node from Gemini output.
    topic_to_data: topic_id → {"suggestions": [...], "youtube_queries": [...], "why_this": "..."}
    """
    for node in getattr(roadmap, "nodes", []):
        tid = getattr(node, "topic_id", "")
        data = topic_to_data.get(tid, {})
        suggestions = data.get("suggestions", [])
        youtube_queries = data.get("youtube_queries", [])
        why_this = data.get("why_this", "")

        if hasattr(node, "suggestions"):
            node.suggestions = suggestions
        elif hasattr(node, "__dict__"):
            node.__dict__["suggestions"] = suggestions

        if hasattr(node, "youtube_queries"):
            node.youtube_queries = youtube_queries
        elif hasattr(node, "__dict__"):
            node.__dict__["youtube_queries"] = youtube_queries

        if hasattr(node, "why_this"):
            node.why_this = why_this
        elif hasattr(node, "__dict__"):
            node.__dict__["why_this"] = why_this
