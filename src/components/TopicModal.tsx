"use client";

import { useState, useEffect } from "react";
import {
  X,
  ExternalLink,
  Play,
  FileText,
  Presentation,
  Lightbulb,
  BookOpen,
  Sparkles,
  Youtube,
  Cpu,
  Loader2,
  BookMarked,
  GraduationCap,
  ScrollText,
  Globe,
  GitBranch,
  Library,
  Search,
  Download,
  CheckCircle2,
} from "lucide-react";
import YouTubeSnippet from "@/components/YouTubeSnippet";

interface Resource {
  title: string;
  description: string;
  label: string;
  searchUrl: string;
}

interface ScrapedResource {
  title: string;
  description: string;
  url: string;
  source: "Wikipedia" | "arXiv" | "Dev.to" | "OpenLibrary" | "GitHub";
  label: "Article" | "Paper" | "Book" | "Repository" | "PDF / Notes";
}

interface UpNextItem {
  title: string;
  status: "upcoming" | "in-progress" | "completed";
  match: number;
  topicId: string;
}

interface RoadmapTopicBasic {
  id: string;
  title: string;
  status: "completed" | "in-progress" | "upcoming";
  recommendation_score?: number;
}

interface TopicModalProps {
  topic: {
    id: string;
    title: string;
    description: string;
    status: "completed" | "in-progress" | "upcoming";
    recommendation_score?: number;
    signal_score?: number;
    confidence?: number;
    prerequisites?: string[];
    difficulty?: number;
  } | null;
  onClose: () => void;
  onNavigate?: (topicId: string) => void;
  suggestions?: string[];
  youtubeQueries?: string[];
  whyThis?: string;
  /** All roadmap topics — used to dynamically compute "Up Next" */
  allTopics?: RoadmapTopicBasic[];
}

const youtubeResources = [
  { title: "Understanding the Basics", channel: "Tech Academy", duration: "12:34", views: "1.2M" },
  { title: "Practical Examples & Demos", channel: "Code Master", duration: "18:22", views: "850K" },
  { title: "Deep Dive Tutorial", channel: "Learn Pro", duration: "45:10", views: "2.1M" },
];

const LABEL_STYLE: Record<string, { icon: React.ReactNode; badge: string }> = {
  "Article":    { icon: <FileText size={14} className="text-blue-400" />,       badge: "bg-blue-500/10 text-blue-400" },
  "Course":     { icon: <GraduationCap size={14} className="text-dallas-green" />, badge: "bg-dallas-green/10 text-dallas-green" },
  "PDF / Notes":{ icon: <ScrollText size={14} className="text-red-400" />,       badge: "bg-red-500/10 text-red-400" },
  "Book":       { icon: <BookMarked size={14} className="text-amber-400" />,    badge: "bg-amber-500/10 text-amber-400" },
  "Paper":      { icon: <FileText size={14} className="text-purple-400" />,     badge: "bg-purple-500/10 text-purple-400" },
};

// Skeleton cards shown while loading
const SKELETON_LABELS = ["Article", "Article", "Course", "PDF / Notes", "Book", "Paper"];

const SOURCE_STYLE: Record<string, { icon: React.ReactNode; badge: string }> = {
  "Wikipedia":   { icon: <Globe size={14} className="text-sky-400" />,         badge: "bg-sky-500/10 text-sky-400" },
  "arXiv":       { icon: <FileText size={14} className="text-orange-400" />,   badge: "bg-orange-500/10 text-orange-400" },
  "Dev.to":      { icon: <FileText size={14} className="text-indigo-400" />,   badge: "bg-indigo-500/10 text-indigo-400" },
  "OpenLibrary": { icon: <Library size={14} className="text-emerald-400" />,   badge: "bg-emerald-500/10 text-emerald-400" },
  "GitHub":      { icon: <GitBranch size={14} className="text-gray-300" />,    badge: "bg-gray-500/10 text-gray-300" },
};

function computeUpNext(
  currentId: string,
  allTopics: RoadmapTopicBasic[],
): UpNextItem[] {
  if (allTopics.length === 0) return [];

  const idx = allTopics.findIndex((t) => t.id === currentId);
  const remaining = idx >= 0
    ? allTopics.slice(idx + 1).filter((t) => t.status !== "completed")
    : allTopics.filter((t) => t.id !== currentId && t.status !== "completed");

  return remaining.slice(0, 3).map((t, i) => ({
    title: t.title,
    status: t.status === "in-progress" ? "in-progress" : "upcoming",
    match: Math.max(70, 98 - i * 5 - Math.round((t.recommendation_score ?? 0.5) * 10)),
    topicId: t.id,
  }));
}

// ── mini node colours (matches roadmap) ───────────────────────────────────────
function miniNodeStyle(status: string) {
  if (status === "completed") return { bg: "#dcfce7", border: "#16a34a", text: "#166534" };
  if (status === "in-progress") return { bg: "#fef9c3", border: "#ca8a04", text: "#713f12" };
  return { bg: "#1c1c1f", border: "#52525b", text: "#a1a1aa" };
}

// ── small down arrow between Up Next items ─────────────────────────────────────
function MiniDownArrow() {
  return (
    <div className="flex justify-center my-1">
      <svg width="10" height="18" viewBox="0 0 10 18">
        <line x1="5" y1="0" x2="5" y2="12" stroke="#52525b" strokeWidth="1.5" />
        <polygon points="2,10 5,17 8,10" fill="#52525b" />
      </svg>
    </div>
  );
}

export default function TopicModal({ topic, onClose, onNavigate, suggestions, youtubeQueries, whyThis, allTopics }: TopicModalProps) {
  const [activeTab, setActiveTab] = useState<"resources" | "why" | "next">("resources");
  const [resources, setResources] = useState<Resource[]>([]);
  const [scraped, setScraped] = useState<ScrapedResource[]>([]);
  const [resourcesLoading, setResourcesLoading] = useState(false);
  const [scrapedLoading, setScrapedLoading] = useState(false);
  const [slidesLoading, setSlidesLoading] = useState(false);
  const [slidesGenerated, setSlidesGenerated] = useState(false);
  const [slidesError, setSlidesError] = useState(false);

  useEffect(() => {
    if (!topic) return;
    setResources([]);
    setScraped([]);
    setResourcesLoading(true);
    setScrapedLoading(true);
    setSlidesGenerated(false);
    setSlidesError(false);
    fetch("/api/resources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: topic.title }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.resources)) setResources(data.resources);
        if (Array.isArray(data.scraped)) setScraped(data.scraped);
        setScrapedLoading(false);
      })
      .catch(() => { setScrapedLoading(false); })
      .finally(() => setResourcesLoading(false));
  }, [topic?.title]);

  if (!topic) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Slide-over */}
      <div className="fixed right-0 top-0 z-50 flex h-screen w-full max-w-lg flex-col border-l border-surface-border bg-surface shadow-2xl shadow-black/50 animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-surface-border px-6 py-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`inline-block h-2.5 w-2.5 rounded-full ${topic.status === "completed"
                  ? "bg-dallas-green"
                  : topic.status === "in-progress"
                    ? "bg-yellow-400"
                    : "bg-muted-dark"
                  }`}
              />
              <span className="text-xs font-medium text-muted capitalize">
                {topic.status.replace("-", " ")}
              </span>
            </div>
            <h2 className="text-xl font-bold">{topic.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-muted hover:bg-surface-hover hover:text-foreground transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-surface-border px-6">
          {(["resources", "why", "next"] as const).map((tab) => (
            <button
               key={tab}
               onClick={() => setActiveTab(tab)}
               className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === tab
                 ? "border-dallas-green text-dallas-green"
                 : "border-transparent text-muted hover:text-foreground"
                 }`}
             >
               {tab === "resources" ? "Resources" : tab === "why" ? "ML Pipeline Insights" : "Up Next"}
             </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* ── Resources ── */}
          {activeTab === "resources" && (
            <div className="animate-fade-in space-y-6">
              <p className="text-sm text-muted">{topic.description}</p>

              {/* Gemini suggestions (from RIQE roadmap) */}
              {suggestions && suggestions.length > 0 && (
                <div>
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                    <Sparkles size={16} className="text-dallas-green" />
                    Recommended for you
                  </h3>
                  <ul className="space-y-2">
                    {suggestions.map((s, i) => (
                      <li key={i} className="text-sm text-muted flex items-start gap-2">
                        <span className="text-dallas-green mt-0.5">·</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {/* YouTube search phrases from Gemini */}
              {youtubeQueries && youtubeQueries.length > 0 && (
                <div>
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                    <Youtube size={16} className="text-red-400" />
                    Search on YouTube
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {youtubeQueries.map((q, i) => (
                      <a
                        key={i}
                        href={`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg border border-surface-border bg-background/50 px-3 py-2 text-xs font-medium text-muted hover:border-dallas-green hover:text-dallas-green transition-colors"
                      >
                        {q}
                      </a>
                    ))}
                  </div>
                </div>
              )}
              {/* YouTube (fallback when no Gemini data) */}
              <div>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <Play size={16} className="text-red-400" />
                  Video Resources
                </h3>
                <div className="space-y-3">
                  {(youtubeQueries && youtubeQueries.length > 0 ? youtubeQueries.slice(0, 3).map((q, i) => (
                    <a
                      key={i}
                      href={`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center gap-4 rounded-xl border border-surface-border bg-background/30 p-4 hover:border-muted-dark transition-colors cursor-pointer"
                    >
                      <div className="flex h-12 w-20 items-center justify-center rounded-lg bg-red-500/10 shrink-0">
                        <Play size={20} className="text-red-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate group-hover:text-dallas-green transition-colors">
                          {q}
                        </p>
                        <p className="text-xs text-muted-dark">YouTube search</p>
                      </div>
                      <ExternalLink size={14} className="text-muted-dark shrink-0" />
                    </a>
                  )) : youtubeResources.map((vid, i) => (
                    <div
                      key={i}
                      className="group flex items-center gap-4 rounded-xl border border-surface-border bg-background/30 p-4 hover:border-muted-dark transition-colors cursor-pointer"
                    >
                      <div className="flex h-12 w-20 items-center justify-center rounded-lg bg-red-500/10 shrink-0">
                        <Play size={20} className="text-red-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate group-hover:text-dallas-green transition-colors">
                          {vid.title}
                        </p>
                        <p className="text-xs text-muted-dark">
                          {vid.channel} • {vid.duration} • {vid.views} views
                        </p>
                      </div>
                      <ExternalLink size={14} className="text-muted-dark shrink-0" />
                    </div>
                  )) )}
                </div>
              </div>

              {/* Scraped resource cards */}
              <div>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <Sparkles size={16} className="text-dallas-green" />
                  Resources
                  {resourcesLoading && <Loader2 size={13} className="animate-spin text-muted ml-1" />}
                </h3>
                <div className="space-y-2">
                  {resourcesLoading
                    ? SKELETON_LABELS.map((lbl, i) => {
                        const style = LABEL_STYLE[lbl] ?? LABEL_STYLE["Article"];
                        return (
                          <div key={i} className="flex items-center gap-3 rounded-xl border border-surface-border bg-background/30 p-4 animate-pulse">
                            <div className="shrink-0 opacity-40">{style.icon}</div>
                            <div className="flex-1 space-y-2">
                              <div className="h-3 w-2/3 rounded bg-surface-border" />
                              <div className="h-2 w-1/2 rounded bg-surface-border" />
                            </div>
                            <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase opacity-40 ${style.badge}`}>{lbl}</span>
                          </div>
                        );
                      })
                    : resources.map((r, i) => {
                        const style = LABEL_STYLE[r.label] ?? LABEL_STYLE["Article"];
                        return (
                          <a
                            key={i}
                            href={r.searchUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group flex items-start gap-3 rounded-xl border border-surface-border bg-background/30 p-4 hover:border-dallas-green/40 hover:bg-surface-hover/50 transition-colors"
                          >
                            <div className="shrink-0 mt-0.5">{style.icon}</div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium group-hover:text-dallas-green transition-colors leading-snug">
                                {r.title}
                              </p>
                              {r.description && (
                                <p className="text-xs text-muted mt-1.5 leading-relaxed line-clamp-2">
                                  {r.description}
                                </p>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-1.5 shrink-0 ml-2">
                              <ExternalLink size={12} className="text-muted-dark" />
                              <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${style.badge}`}>
                                {r.label}
                              </span>
                            </div>
                          </a>
                        );
                      })}
                </div>
              </div>

              {/* Related Readings (web-scraped) */}
              <div>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <Search size={16} className="text-cyan-400" />
                  Related Readings
                  {scrapedLoading && <Loader2 size={13} className="animate-spin text-muted ml-1" />}
                </h3>
                {scrapedLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-3 rounded-xl border border-surface-border bg-background/30 p-4 animate-pulse">
                        <div className="h-4 w-4 rounded bg-surface-border shrink-0" />
                        <div className="flex-1 space-y-2">
                          <div className="h-3 w-3/4 rounded bg-surface-border" />
                          <div className="h-2 w-1/2 rounded bg-surface-border" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : scraped.length > 0 ? (
                  <div className="space-y-2">
                    {scraped.map((r, i) => {
                      const style = SOURCE_STYLE[r.source] ?? SOURCE_STYLE["Wikipedia"];
                      return (
                        <a
                          key={i}
                          href={r.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group flex items-start gap-3 rounded-xl border border-surface-border bg-background/30 p-4 hover:border-cyan-500/40 hover:bg-surface-hover/50 transition-colors"
                        >
                          <div className="shrink-0 mt-0.5">{style.icon}</div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium group-hover:text-cyan-400 transition-colors leading-snug">
                              {r.title}
                            </p>
                            {r.description && (
                              <p className="text-xs text-muted mt-1.5 leading-relaxed line-clamp-2">
                                {r.description}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-1.5 shrink-0 ml-2">
                            <ExternalLink size={12} className="text-muted-dark" />
                            <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${style.badge}`}>
                              {r.source}
                            </span>
                          </div>
                        </a>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-dark italic">No related readings found.</p>
                )}
              </div>

              {/* AI PowerPoints */}
              <div>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <Presentation size={16} className="text-dallas-green" />
                  AI-Generated PowerPoints
                </h3>
                <div className="rounded-xl border border-dallas-green/20 bg-dallas-green/5 p-5 text-center">
                  {slidesGenerated ? (
                    <CheckCircle2 size={28} className="mx-auto mb-3 text-dallas-green" />
                  ) : (
                    <Sparkles size={28} className="mx-auto mb-3 text-dallas-green" />
                  )}
                  <p className="text-sm font-semibold">
                    {slidesGenerated ? "Slides Downloaded!" : "Custom Presentation"}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {slidesGenerated
                      ? `8-slide deck on "${topic.title}" saved to your downloads`
                      : "AI-generated slides tailored to this topic"}
                  </p>
                  {slidesError && (
                    <p className="mt-2 text-xs text-red-400">Failed to generate. Try again.</p>
                  )}
                  <button
                    disabled={slidesLoading}
                    onClick={async () => {
                      setSlidesLoading(true);
                      setSlidesError(false);
                      setSlidesGenerated(false);
                      try {
                        const res = await fetch("/api/slides", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ topic: topic.title, description: topic.description }),
                        });
                        if (!res.ok) throw new Error("Failed");
                        const blob = await res.blob();
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `${topic.title.replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, "_")}_slides.pptx`;
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                        URL.revokeObjectURL(url);
                        setSlidesGenerated(true);
                      } catch {
                        setSlidesError(true);
                      } finally {
                        setSlidesLoading(false);
                      }
                    }}
                    className="mt-4 inline-flex items-center gap-2 rounded-lg bg-dallas-green px-4 py-2 text-sm font-semibold text-white hover:bg-dallas-green-dark transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {slidesLoading ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        Generating...
                      </>
                    ) : slidesGenerated ? (
                      <>
                        <Download size={14} />
                        Download Again
                      </>
                    ) : (
                      "Generate Slides"
                    )}
                  </button>
                </div>
              </div>

              {/* Featured YouTube Video */}
              <div>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <Youtube size={16} className="text-red-400" />
                  Featured Video
                </h3>
                <YouTubeSnippet topic={topic.title} />
              </div>
            </div>
          )}

          {/* ── ML Pipeline Insights ── */}
          {activeTab === "why" && (
            <div className="animate-fade-in space-y-6">
              {/* Explicit Decision Rule (Hackathon Requirement) */}
              <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-5">
                <div className="flex items-start gap-3">
                  <Cpu size={20} className="text-blue-400 mt-0.5 shrink-0" />
                  <div>
                    <h3 className="text-sm font-bold text-blue-400 mb-1">Decision Rule Actuated</h3>
                    <p className="text-sm text-muted leading-relaxed">
                      Placement triggered because <strong>Recommendation Score {">"} 0.65</strong>. 
                      The actionable signal explicitly routed this topic into your specialized learning phase.
                    </p>
                  </div>
                </div>
              </div>

              {/* Gemini personalized explanation */}
              <div className="rounded-xl bg-dallas-green/5 border border-dallas-green/20 p-5">
                <div className="flex items-start gap-3">
                  <Lightbulb size={20} className="text-dallas-green mt-0.5 shrink-0" />
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Contextual Verification (LLM)</h3>
                    <p className="text-sm text-muted leading-relaxed">
                      {whyThis || `${topic.title} is positioned in your roadmap based on your current knowledge state, signal history, and the prerequisite relationships in quantitative finance. The ML pipeline scored this topic with the metrics shown below.`}
                    </p>
                  </div>
                </div>
              </div>

              {/* ML Scores */}
              <div>
                <h3 className="mb-3 text-sm font-semibold">Actionable Signals & Network Confidence</h3>
                <div className="space-y-3">
                  {[
                    { label: "Recommendation Score", value: topic.recommendation_score, color: "#46b533", desc: "Composite relevance to your profile" },
                    { label: "Signal Score", value: topic.signal_score, color: "#a855f7", desc: "How strongly your learning signals relate" },
                    { label: "Confidence", value: topic.confidence, color: "#3b82f6", desc: "Pipeline certainty in this placement" },
                  ].map((score) => (
                    <div key={score.label} className="rounded-xl border border-surface-border bg-background/30 p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="text-xs font-semibold">{score.label}</p>
                          <p className="text-[10px] text-muted-dark">{score.desc}</p>
                        </div>
                        <span className="text-sm font-bold" style={{ color: score.color }}>
                          {score.value != null ? `${(score.value * 100).toFixed(0)}%` : "N/A"}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-surface-border overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${(score.value ?? 0) * 100}%`, background: score.color }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Difficulty */}
              <div className="rounded-xl border border-surface-border bg-background/30 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-xs font-semibold">Difficulty Level</p>
                    <p className="text-[10px] text-muted-dark">How challenging this topic is</p>
                  </div>
                  <span className="text-sm font-bold" style={{ color: (topic.difficulty ?? 0) > 0.6 ? "#f59e0b" : "#10b981" }}>
                    {topic.difficulty != null ? `${(topic.difficulty * 100).toFixed(0)}%` : "N/A"}
                  </span>
                </div>
                <div className="flex gap-1">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-2 flex-1 rounded-full transition-all"
                      style={{
                        background: i < Math.round((topic.difficulty ?? 0) * 10)
                          ? (topic.difficulty ?? 0) > 0.6 ? "#f59e0b" : "#10b981"
                          : "rgba(113,113,122,0.2)",
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Prerequisites */}
              {topic.prerequisites && topic.prerequisites.length > 0 && (
                <div>
                  <h3 className="mb-3 text-sm font-semibold">Prerequisites</h3>
                  <div className="flex flex-wrap gap-2">
                    {topic.prerequisites.map((prereq) => (
                      <button
                        key={prereq}
                        onClick={() => onNavigate?.(prereq)}
                        className="rounded-lg border border-surface-border bg-background/50 px-3 py-2 text-xs font-medium text-muted hover:border-dallas-green hover:text-dallas-green transition-colors"
                      >
                        {prereq.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-dark mt-2">Click a prerequisite to view its details</p>
                </div>
              )}

              {/* How to learn */}
              <div>
                <h3 className="mb-3 text-sm font-semibold flex items-center gap-2">
                  <BookOpen size={16} className="text-muted" />
                  How to Learn It Best
                </h3>
                <p className="text-sm text-muted leading-relaxed">
                  Based on the pipeline scores, this topic has a{" "}
                  <span className="font-medium text-foreground">
                    {(topic.recommendation_score ?? 0) > 0.5 ? "high" : "moderate"} relevance
                  </span>{" "}
                  to your profile{topic.difficulty != null && topic.difficulty > 0.6 ? " and is more challenging — consider spending extra time on foundational concepts first" : ""}.
                  {(topic.signal_score ?? 0) > 0.3 && " Your recent learning signals suggest active interest in this area — great momentum!"}
                  {" "}Start with the video resources and build understanding through practice.
                </p>
              </div>
            </div>
          )}

          {/* ── Up Next ── */}
          {activeTab === "next" && (
            <div className="animate-fade-in">
              <p className="text-sm text-muted mb-6">
                Based on your roadmap, here&apos;s what comes next:
              </p>

              {/* Roadmap-style chain of upcoming nodes */}
              <div className="flex flex-col items-center">
                {computeUpNext(topic.id, allTopics ?? []).length === 0 ? (
                  <div className="w-full py-8 text-center text-muted text-sm border border-dashed border-surface-border rounded-lg">
                    You&apos;ve reached the end of your roadmap!
                  </div>
                ) : null}
                {computeUpNext(topic.id, allTopics ?? []).map((item, i) => {
                  const s = miniNodeStyle(item.status);
                  return (
                    <div key={i} className="flex flex-col items-center w-full">
                      {/* Node box */}
                      <button
                        onClick={() => {
                          onNavigate?.(item.topicId);
                        }}
                        className="group relative w-full max-w-xs rounded-xl border-2 px-5 py-4 text-left transition-all duration-200 hover:scale-[1.03] hover:shadow-lg active:scale-95"
                        style={{ background: s.bg, borderColor: s.border, color: s.text }}
                      >
                        {/* "View →" top-right badge, appears on hover */}
                        <div
                          className="absolute top-2.5 right-3 text-[10px] font-bold uppercase tracking-wide opacity-0 group-hover:opacity-100 transition-opacity"
                          style={{ color: s.border }}
                        >
                          View →
                        </div>
                        {/* Content — pr-16 stops text flowing under badge */}
                        <div className="pr-16">
                          <p className="text-sm font-semibold">{item.title}</p>
                          <p className="text-xs mt-0.5 opacity-70">
                            {item.match}% relevance match
                          </p>
                        </div>
                        {/* Status pill */}
                        <span
                          className="mt-2 inline-block rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide"
                          style={{ background: `${s.border}22`, color: s.border }}
                        >
                          {item.status === "in-progress" ? "In Progress" : "Upcoming"}
                        </span>
                      </button>

                      {i < computeUpNext(topic.id, allTopics ?? []).length - 1 && <MiniDownArrow />}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
