/**
 * RIQE pipeline client — calls local API routes that run the Python model in-process.
 * No external API URL; the app uses the integrated pipeline via /api/roadmap/*.
 */

const API_BASE = "";

export interface RoadmapNode {
  topic_id: string;
  title: string;
  description: string;
  difficulty: number;
  prerequisites: string[];
  recommendation_score: number;
  signal_score: number;
  confidence: number;
  suggestions: string[];
  youtube_queries: string[];
}

export interface RoadmapResponse {
  roadmap_id: string;
  user_id: string;
  nodes: RoadmapNode[];
  created_at: string;
  version: number;
  quality_score: number;
}

export interface OnboardResponse {
  state: { user_id: string; completed_topics: string[]; weak_topics: string[] };
  roadmap: RoadmapResponse;
}

/** Pipeline is always available locally (no env needed). */
export function isRiqeConfigured(): boolean {
  return true;
}

/** Create a new user and get initial quant roadmap (runs local Python pipeline). */
export async function riqeOnboard(params: {
  user_id: string;
  resume_text: string;
  skill_scores: Record<string, number>;
  interests: string[];
  field_of_study: string;
  timeframe_weeks: number;
  learning_history?: Array<{ topic_id: string; completion_rate: number; quiz_score: number; time_spent_minutes: number; revisit_count?: number }>;
}): Promise<OnboardResponse> {
  const res = await fetch(`${API_BASE}/api/roadmap/onboard`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: params.user_id,
      resume_text: params.resume_text,
      skill_scores: params.skill_scores,
      interests: params.interests,
      field_of_study: params.field_of_study,
      timeframe_weeks: params.timeframe_weeks,
      learning_history: params.learning_history ?? [],
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Onboard failed: ${res.status}`);
  }
  return data as OnboardResponse;
}

/** Update the current roadmap using a prompt (runs local Python pipeline). */
export async function riqeUpdateRoadmap(user_id: string, text: string): Promise<RoadmapResponse> {
  const res = await fetch(`${API_BASE}/api/roadmap/signal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id, text }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Update roadmap failed: ${res.status}`);
  }
  return data as RoadmapResponse;
}

/** Create a new roadmap for a different quant area (runs local Python pipeline). */
export async function riqeCreateNewRoadmap(user_id: string, new_roadmap_id: string): Promise<OnboardResponse> {
  const res = await fetch(`${API_BASE}/api/roadmap/switch-roadmap`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id, new_roadmap_id }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Switch roadmap failed: ${res.status}`);
  }
  return data as OnboardResponse;
}
