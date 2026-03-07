"use client";

import { useEffect, useState } from "react";
import { Play, AlertCircle } from "lucide-react";

interface VideoData {
    videoId: string;
    title: string;
    channelTitle: string;
    thumbnailUrl: string;
}

interface YouTubeSnippetProps {
    topic: string;
}

export default function YouTubeSnippet({ topic }: YouTubeSnippetProps) {
    const [video, setVideo] = useState<VideoData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!topic) return;

        let cancelled = false;

        const fetchVideo = async () => {
            setLoading(true);
            setError(null);
            setVideo(null);

            try {
                const res = await fetch(
                    `/api/youtube?query=${encodeURIComponent(topic)}`
                );
                const data = await res.json();

                if (cancelled) return;

                if (!res.ok) {
                    setError(data.error || "Failed to load video");
                    return;
                }

                setVideo(data);
            } catch {
                if (!cancelled) {
                    setError("Network error. Could not fetch video.");
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        fetchVideo();

        return () => {
            cancelled = true;
        };
    }, [topic]);

    // Loading skeleton
    if (loading) {
        return (
            <div className="mt-1 space-y-3">
                <div className="aspect-video w-full animate-pulse rounded-lg bg-zinc-800" />
                <div className="space-y-2">
                    <div className="h-4 w-3/4 animate-pulse rounded bg-zinc-800" />
                    <div className="h-3 w-1/2 animate-pulse rounded bg-zinc-800" />
                </div>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="mt-1 flex items-center gap-2 rounded-lg border border-surface-border bg-background/30 px-4 py-3">
                <AlertCircle size={16} className="flex-shrink-0 text-muted-dark" />
                <p className="text-xs text-muted-dark">{error}</p>
            </div>
        );
    }

    // No video found
    if (!video) return null;

    return (
        <div className="mt-1 space-y-3">
            {/* Iframe wrapper with hover glow */}
            <div className="group relative overflow-hidden rounded-lg border border-zinc-800 transition-all duration-300 hover:border-dallas-green/60 hover:shadow-[0_0_20px_rgba(70,181,51,0.15)]">
                <iframe
                    src={`https://www.youtube.com/embed/${video.videoId}?start=123`}
                    title={video.title}
                    className="aspect-video w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                />
            </div>

            {/* Video info */}
            <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-red-500/10">
                    <Play size={14} className="text-red-400" />
                </div>
                <div className="min-w-0">
                    <p
                        className="text-sm font-medium leading-snug line-clamp-2"
                        dangerouslySetInnerHTML={{ __html: video.title }}
                    />
                    <p className="mt-0.5 text-xs text-muted-dark">{video.channelTitle}</p>
                </div>
            </div>
        </div>
    );
}
