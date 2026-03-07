import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";

export async function POST(request: NextRequest) {
    const supabase = await createClient();

    // 1. Authenticate user and get provider token
    const { data: { session } } = await supabase.auth.getSession();

    if (!session || !session.provider_token) {
        return NextResponse.json(
            { error: "No Google Calendar access. Please sign in again.", code: "NO_PROVIDER_TOKEN" },
            { status: 401 }
        );
    }

    const token = session.provider_token;
    const authHeaders = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
    };

    try {
        const body = await request.json();
        const eventsToSync: { title: string; year: number; month: number; day: number }[] = body.events || [];

        // 2. Find or Create the "Luminary" calendar
        let luminaryCalId = null;

        // Fetch calendar list
        const listRes = await fetch(`${CALENDAR_API_BASE}/users/me/calendarList`, { headers: authHeaders });
        if (!listRes.ok) throw new Error("Failed to fetch calendar list");

        const listData = await listRes.json();
        const luminaryCal = listData.items?.find((cal: Record<string, unknown>) => cal.summary === "Luminary");

        if (luminaryCal) {
            luminaryCalId = luminaryCal.id;
        } else {
            // Create the calendar
            const createRes = await fetch(`${CALENDAR_API_BASE}/calendars`, {
                method: "POST",
                headers: authHeaders,
                body: JSON.stringify({ summary: "Luminary" }),
            });
            if (!createRes.ok) throw new Error("Failed to create Luminary calendar");

            const createData = await createRes.json();
            luminaryCalId = createData.id;
        }

        // 3. Clear existing events from the Luminary calendar (optional, but good for "overwrite")
        const eventsRes = await fetch(`${CALENDAR_API_BASE}/calendars/${encodeURIComponent(luminaryCalId as string)}/events`, { headers: authHeaders });
        if (eventsRes.ok) {
            const eventsData = await eventsRes.json();
            const existingEvents = eventsData.items || [];

            // Delete them all (in parallel for speed)
            await Promise.all(
                existingEvents.map((ev: Record<string, unknown>) =>
                    fetch(`${CALENDAR_API_BASE}/calendars/${encodeURIComponent(luminaryCalId as string)}/events/${ev.id}`, {
                        method: "DELETE",
                        headers: authHeaders,
                    })
                )
            );
        }

        // 4. Insert new events
        const insertPromises = eventsToSync.map((event: { title: string; year: number; month: number; day: number }) => {
            return fetch(`${CALENDAR_API_BASE}/calendars/${encodeURIComponent(luminaryCalId as string)}/events`, {
                method: "POST",
                headers: authHeaders,
                body: JSON.stringify({
                    summary: event.title,
                    description: "Created by Luminary App",
                    start: {
                        dateTime: new Date(event.year, event.month, event.day, 9, 0, 0).toISOString(),
                        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    },
                    end: {
                        dateTime: new Date(event.year, event.month, event.day, 10, 0, 0).toISOString(),
                        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    },
                }),
            });
        });

        await Promise.all(insertPromises);

        return NextResponse.json({ success: true, message: "Calendar synced successfully" });

    } catch (err: unknown) {
        console.error("Calendar Sync error:", err);
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Failed to sync calendar" },
            { status: 500 }
        );
    }
}
