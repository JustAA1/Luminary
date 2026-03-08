import { NextRequest, NextResponse } from "next/server";

const YOUTUBE_API_URL = "https://www.googleapis.com/youtube/v3/search";

export async function GET(request: NextRequest) {
    const query = request.nextUrl.searchParams.get("query");

    if (!query) {
        return NextResponse.json(
            { error: "Missing 'query' parameter" },
            { status: 400 }
        );
    }

    const apiKey = process.env.YOUTUBE_API_KEY;

    if (!apiKey) {
        return NextResponse.json(
            { error: "YouTube API key is not configured. Set YOUTUBE_API_KEY in .env.local." },
            { status: 500 }
        );
    }

    try {
        const searchParams = new URLSearchParams({
            part: "snippet",
            type: "video",
            maxResults: "1",
            q: `${query} tutorial or explanation`,
            key: apiKey,
        });

        const response = await fetch(`${YOUTUBE_API_URL}?${searchParams.toString()}`);
        const data = await response.json();

        if (!response.ok) {
            const message =
                data?.error?.message || "YouTube API request failed";
            return NextResponse.json({ error: message }, { status: response.status });
        }

        if (!data.items || data.items.length === 0) {
            return NextResponse.json(
                { error: "No videos found for this topic" },
                { status: 404 }
            );
        }

        const video = data.items[0];
        return NextResponse.json({
            videoId: video.id.videoId,
            title: video.snippet.title,
            channelTitle: video.snippet.channelTitle,
            thumbnailUrl: video.snippet.thumbnails?.high?.url || video.snippet.thumbnails?.default?.url,
        });
    } catch (error) {
        console.error("YouTube API error:", error);
        return NextResponse.json(
            { error: "Failed to fetch video. Please try again later." },
            { status: 500 }
        );
    }
}
