import { NextRequest, NextResponse } from "next/server";
import { runRiqeCli } from "../runRiqeCli";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = JSON.stringify({
      action: "signal",
      payload: {
        user_id: body.user_id,
        text: body.text ?? "",
      },
    });
    const result = await runRiqeCli(input);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Signal failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
