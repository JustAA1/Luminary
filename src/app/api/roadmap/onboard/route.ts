import { NextRequest, NextResponse } from "next/server";
import { runRiqeCli } from "../runRiqeCli";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = JSON.stringify({
      action: "onboard",
      payload: {
        user_id: body.user_id,
        resume_text: body.resume_text ?? "",
        skill_scores: body.skill_scores ?? {},
        interests: body.interests ?? [],
        field_of_study: body.field_of_study ?? "quantitative_finance",
        timeframe_weeks: body.timeframe_weeks ?? 12,
        learning_history: body.learning_history ?? [],
      },
    });
    const result = await runRiqeCli(input);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Onboard failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
