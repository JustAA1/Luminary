import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const CALENDAR_API_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

export async function GET(request: NextRequest) {
    const supabase = await createClient();

    // Get the current session with provider token
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        return NextResponse.json(
            { error: "Not authenticated", code: "NOT_AUTHENTICATED" },
            { status: 401 }
        );
    }

    const providerToken = session.provider_token;

    if (!providerToken) {
        return NextResponse.json(
            { error: "No Google Calendar access. Please sign out and sign in again with Google.", code: "NO_PROVIDER_TOKEN" },
            { status: 401 }
        );
    }

    // Get time range from query params
    const timeMin = request.nextUrl.searchParams.get("timeMin");
    const timeMax = request.nextUrl.searchParams.get("timeMax");

    if (!timeMin || !timeMax) {
        return NextResponse.json(
            { error: "Missing timeMin or timeMax parameters" },
            { status: 400 }
        );
    }

    try {
        const params = new URLSearchParams({
            timeMin,
            timeMax,
            singleEvents: "true",
            orderBy: "startTime",
            maxResults: "50",
        });

        const response = await fetch(`${CALENDAR_API_URL}?${params.toString()}`, {
            headers: {
                Authorization: `Bearer ${providerToken}`,
            },
        });

        if (!response.ok) {
            if (response.status === 401) {
                return NextResponse.json(
                    { error: "Google token expired. Please sign out and sign in again.", code: "TOKEN_EXPIRED" },
                    { status: 401 }
                );
            }
            const errData = await response.json();
            return NextResponse.json(
                { error: errData?.error?.message || "Failed to fetch calendar events" },
                { status: response.status }
            );
        }

        const data = await response.json();
        const events = mapGoogleEvents(data.items || []);

        return NextResponse.json({ events });
    } catch (err) {
        console.error("Calendar API error:", err);
        return NextResponse.json(
            { error: "Failed to fetch calendar events" },
            { status: 500 }
        );
    }
}

interface GoogleEvent {
    id: string;
    summary?: string;
    start: { dateTime?: string; date?: string };
    end: { dateTime?: string; date?: string };
}

function mapGoogleEvents(items: GoogleEvent[]) {
    return items.map((item) => {
        const startStr = item.start.dateTime || item.start.date || "";
        const startDate = new Date(startStr);

        let time = "All day";
        if (item.start.dateTime) {
            time = startDate.toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
            });
        }

        return {
            id: item.id,
            day: startDate.getDate(),
            month: startDate.getMonth(),
            year: startDate.getFullYear(),
            title: item.summary || "Untitled Event",
            time,
            color: "bg-blue-500",
            type: "google" as const,
        };
    });
}
