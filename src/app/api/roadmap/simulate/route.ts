import { NextRequest, NextResponse } from "next/server";
import { runRiqeCli } from "../runRiqeCli";

export const maxDuration = 60;

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

async function callGemini(prompt: string, apiKey: string): Promise<string> {
  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.75, maxOutputTokens: 300 },
  };

  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  return (data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim();
}

function buildSignalPrompt(
  roadmapTopics: { title: string; status: string; description?: string }[],
  step: number,
  previousSignals: string[]
): string {
  const currentTopic =
    roadmapTopics.find((t) => t.status === "in-progress") ?? roadmapTopics[0];
  const completedTitles = roadmapTopics
    .filter((t) => t.status === "completed")
    .map((t) => t.title);
  const upcomingTitles = roadmapTopics
    .filter((t) => t.status === "upcoming")
    .slice(0, 3)
    .map((t) => t.title);

  const prevContext =
    previousSignals.length > 0
      ? `\nPrevious learning signals (show clear progression — do not repeat):\n${previousSignals
          .slice(-4)
          .map((s, i) => `  Step ${step - previousSignals.length + i}: "${s}"`)
          .join("\n")}`
      : "";

  return `You are simulating a quant finance professional using an AI learning platform. Generate ONE realistic, natural-sounding learning signal (1-2 sentences) that this person might send at step ${step} of their journey.

Current roadmap context:
- Actively studying: ${currentTopic?.title ?? "Quantitative Finance fundamentals"}${currentTopic?.description ? ` — "${currentTopic.description.slice(0, 90)}"` : ""}
- Completed: ${completedTitles.length > 0 ? completedTitles.join(", ") : "none yet"}
- Coming up: ${upcomingTitles.length > 0 ? upcomingTitles.join(", ") : "not set"}${prevContext}

Rules:
- Be varied and realistic: rotate through confusion, insight, curiosity, wanting to go deeper, requesting focus shift
- Reference specific quant concepts (e.g. Ito's lemma, Black-Scholes, VaR, Cholesky decomposition, GARCH, Monte Carlo, mean-reversion)
- Show natural progression — each step should logically follow from the last
- Write from the learner's first-person perspective
- Return ONLY the signal text, no preamble, no quotes

Signal:`;
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is not configured on the server." },
      { status: 500 }
    );
  }

  let body: {
    user_id?: string;
    roadmap_topics?: { title: string; status: string; description?: string }[];
    step?: number;
    previous_signals?: string[];
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    user_id,
    roadmap_topics = [],
    step = 1,
    previous_signals = [],
  } = body;

  if (!user_id) {
    return NextResponse.json({ error: "user_id is required" }, { status: 400 });
  }

  // Step 1: Ask Gemini to generate a realistic learning signal
  let signal: string;
  try {
    const geminiPrompt = buildSignalPrompt(roadmap_topics, step, previous_signals);
    signal = await callGemini(geminiPrompt, apiKey);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gemini call failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  if (!signal) {
    return NextResponse.json(
      { error: "Gemini returned an empty signal" },
      { status: 502 }
    );
  }

  // Step 2: Feed the signal into the RIQE pipeline to update the roadmap
  let roadmap: Record<string, unknown> | null = null;
  let riqeError: string | null = null;

  try {
    const riqeInput = JSON.stringify({
      action: "signal",
      payload: { user_id, text: signal },
    });
    const result = await runRiqeCli(riqeInput);
    if ("error" in result) {
      riqeError = String(result.error);
    } else {
      roadmap = result;
    }
  } catch (e) {
    riqeError = e instanceof Error ? e.message : "RIQE pipeline failed";
  }

  return NextResponse.json({ signal, roadmap, riqe_error: riqeError });
}
