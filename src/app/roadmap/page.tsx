"use client";

import { useState, useEffect, useRef } from "react";
import { Map, Wand2, RefreshCw, PlusCircle, Loader2 } from "lucide-react";
import TopicModal from "@/components/TopicModal";
import { animate, stagger } from "animejs";
import { useProfileData } from "@/hooks/useProfileData";
import {
  isRiqeConfigured,
  riqeOnboard,
  riqeUpdateRoadmap,
  riqeCreateNewRoadmap,
  type RoadmapResponse,
  type RoadmapNode,
} from "@/lib/riqe";

/** Map RIQE API node to UI topic shape (no subtopics; status from position). */
function toTopic(node: RoadmapNode, index: number): {
  id: string;
  title: string;
  description: string;
  status: "completed" | "in-progress" | "upcoming";
  subtopics: { id: string; title: string; status: "completed" | "in-progress" | "upcoming" }[];
  suggestions?: string[];
  youtube_queries?: string[];
} {
  return {
    id: node.topic_id,
    title: node.title,
    description: node.description,
    status: index === 0 ? "in-progress" : "upcoming",
    subtopics: [],
    suggestions: node.suggestions,
    youtube_queries: node.youtube_queries,
  };
}

function CircularProgress({ percent }: { percent: number }) {
  const r = 54;
  const circ = 2 * Math.PI * r;
  const dashOffset = circ * (1 - percent / 100);
  return (
    <div className="relative w-32 h-32 flex-shrink-0">
      <svg viewBox="0 0 124 124" className="w-full h-full -rotate-90">
        <defs>
          <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#46b533" />
            <stop offset="50%" stopColor="#eab308" />
            <stop offset="100%" stopColor="#ef4444" />
          </linearGradient>
        </defs>
        <circle cx="62" cy="62" r={r} fill="none" stroke="#27272a" strokeWidth="10" />
        <circle
          cx="62" cy="62" r={r} fill="none"
          stroke="url(#ringGrad)" strokeWidth="10" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={dashOffset}
          style={{ transition: "stroke-dashoffset 1.4s cubic-bezier(.22,.68,0,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold">{percent}%</span>
        <span className="text-[10px] text-muted">done</span>
      </div>
    </div>
  );
}

function statusColors(status: string) {
  if (status === "completed") return { border: "#16a34a", bg: "#dcfce7", text: "#166534", badge: "bg-emerald-500" };
  if (status === "in-progress") return { border: "#ca8a04", bg: "#fef9c3", text: "#713f12", badge: "bg-yellow-400" };
  return { border: "#6b7280", bg: "#f3f4f6", text: "#374151", badge: "bg-zinc-400" };
}

function DownArrow({ green }: { green?: boolean }) {
  return (
    <svg width="14" height="28" viewBox="0 0 14 28" className="mx-auto my-0">
      <line x1="7" y1="0" x2="7" y2="20" stroke={green ? "#46b533" : "#52525b"} strokeWidth="2" />
      <polygon points="3,17 7,26 11,17" fill={green ? "#46b533" : "#52525b"} />
    </svg>
  );
}

interface NodeBoxProps {
  title: string;
  status: string;
  onClick: () => void;
  size?: "main" | "sub";
}
function NodeBox({ title, status, onClick, size = "sub" }: NodeBoxProps) {
  const c = statusColors(status);
  return (
    <button
      onClick={onClick}
      className="rounded-xl text-center font-semibold transition-all duration-200 hover:scale-105 hover:shadow-lg active:scale-95"
      style={{
        background: c.bg,
        border: `2px solid ${c.border}`,
        color: c.text,
        padding: size === "main" ? "10px 24px" : "7px 14px",
        fontSize: size === "main" ? "14px" : "12px",
        minWidth: size === "main" ? 200 : 130,
        boxShadow: status === "in-progress" ? `0 0 14px ${c.border}55` : undefined,
      }}
    >
      {title}
    </button>
  );
}

interface RoadmapTopicUI {
  id: string;
  title: string;
  description: string;
  status: "completed" | "in-progress" | "upcoming";
  subtopics: { id: string; title: string; status: "completed" | "in-progress" | "upcoming" }[];
  suggestions?: string[];
  youtube_queries?: string[];
}

function RoadmapRow({
  topic,
  onSelect,
  rowRef,
}: {
  topic: RoadmapTopicUI;
  onSelect: (t: RoadmapTopicUI) => void;
  rowRef: (el: HTMLDivElement | null) => void;
}) {
  return (
    <div ref={rowRef} className="flex items-center justify-center gap-0 w-full opacity-0">
      <div className="flex flex-col items-end gap-3 min-w-[160px]" />
      <NodeBox
        title={topic.title}
        status={topic.status}
        size="main"
        onClick={() => onSelect(topic)}
      />
      <div className="flex flex-col items-start gap-3 min-w-[160px]" />
    </div>
  );
}

const STORAGE_KEY = "luminary_roadmap";
const STORAGE_ID_KEY = "luminary_roadmap_id";

export default function RoadmapPage() {
  const { userId, loading: profileLoading } = useProfileData();
  const [selectedTopic, setSelectedTopic] = useState<RoadmapTopicUI | null>(null);
  const [roadmap, setRoadmap] = useState<RoadmapTopicUI[]>([]);
  const [roadmapId, setRoadmapId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [updateBusy, setUpdateBusy] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const nodeRefs = useRef<(HTMLDivElement | null)[]>([]);
  const headerRef = useRef<HTMLDivElement>(null);

  const persistRoadmap = (res: RoadmapResponse) => {
    const topics: RoadmapTopicUI[] = res.nodes.map((n, i) => toTopic(n, i));
    setRoadmap(topics);
    setRoadmapId(res.roadmap_id);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(topics));
      localStorage.setItem(STORAGE_ID_KEY, res.roadmap_id);
    } catch {}
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const id = localStorage.getItem(STORAGE_ID_KEY);
      if (raw && id) {
        const parsed = JSON.parse(raw) as RoadmapTopicUI[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setRoadmap(parsed);
          setRoadmapId(id);
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (headerRef.current) {
      animate(headerRef.current, { opacity: [0, 1], translateY: [-16, 0], duration: 500, easing: "outCubic" });
    }
    const els = nodeRefs.current.filter(Boolean) as HTMLDivElement[];
    if (els.length > 0) {
      animate(els, {
        opacity: [0, 1], scale: [0.88, 1], translateY: [18, 0],
        delay: stagger(110, { start: 250 }), duration: 500, easing: "outElastic(1, .7)",
      });
    }
  }, [roadmap]);

  const handleUpdateRoadmap = async () => {
    if (!prompt.trim() || !userId || !isRiqeConfigured()) {
      if (!isRiqeConfigured()) setErrorToast("RIQE API URL not set. Add NEXT_PUBLIC_RIQE_API_URL to .env.local.");
      else setErrorToast("Enter a prompt to update your roadmap.");
      setTimeout(() => setErrorToast(null), 3500);
      return;
    }
    setUpdateBusy(true);
    setErrorToast(null);
    try {
      const res = await riqeUpdateRoadmap(userId, prompt.trim());
      persistRoadmap(res);
      setSuccessToast("Roadmap updated with your input.");
      setTimeout(() => setSuccessToast(null), 3000);
    } catch (e) {
      setErrorToast(e instanceof Error ? e.message : "Update failed");
      setTimeout(() => setErrorToast(null), 4000);
    } finally {
      setUpdateBusy(false);
    }
  };

  const handleCreateNewRoadmap = async () => {
    if (!userId || !isRiqeConfigured()) {
      setErrorToast("RIQE API URL not set or not signed in.");
      setTimeout(() => setErrorToast(null), 3500);
      return;
    }
    setCreateBusy(true);
    setErrorToast(null);
    try {
      const newId = crypto.randomUUID?.() ?? `rm-${Date.now()}`;
      const res = await riqeCreateNewRoadmap(userId, newId);
      persistRoadmap(res.roadmap);
      setSuccessToast("New roadmap created for a different quant area.");
      setTimeout(() => setSuccessToast(null), 3000);
    } catch (e) {
      setErrorToast(e instanceof Error ? e.message : "Create failed. You may need to onboard first.");
      setTimeout(() => setErrorToast(null), 4000);
    } finally {
      setCreateBusy(false);
    }
  };

  const handleGenerateFirst = async () => {
    if (!userId || !isRiqeConfigured()) {
      setErrorToast("RIQE API URL not set or not signed in.");
      setTimeout(() => setErrorToast(null), 3500);
      return;
    }
    setCreateBusy(true);
    setErrorToast(null);
    try {
      const res = await riqeOnboard({
        user_id: userId,
        resume_text: "Quantitative finance: derivatives, risk, statistics, and programming.",
        skill_scores: { math: 0.5, programming: 0.5, finance: 0.5 },
        interests: ["derivatives", "risk management", "quantitative finance"],
        field_of_study: "Quantitative Finance",
        timeframe_weeks: 12,
      });
      persistRoadmap(res.roadmap);
      setSuccessToast("Your first quant roadmap is ready.");
      setTimeout(() => setSuccessToast(null), 3000);
    } catch (e) {
      setErrorToast(e instanceof Error ? e.message : "Generate failed");
      setTimeout(() => setErrorToast(null), 4000);
    } finally {
      setCreateBusy(false);
    }
  };

  const handleNavigate = (topicId: string) => {
    const t = roadmap.find((r) => r.id === topicId);
    if (t) setSelectedTopic(t);
    else {
      setErrorToast("Topic not found.");
      setTimeout(() => setErrorToast(null), 2500);
    }
  };

  const completedCount = roadmap.filter((t) => t.status === "completed").length;
  const inProgressCount = roadmap.filter((t) => t.status === "in-progress").length;
  const percent = roadmap.length ? Math.round(((completedCount + inProgressCount * 0.5) / roadmap.length) * 100) : 0;

  if (profileLoading) {
    return (
      <div className="min-h-screen px-4 py-8 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-dallas-green" />
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-8 md:px-8">
      <div ref={headerRef} className="mb-8 opacity-0">
        <div className="flex items-center gap-2 text-sm text-dallas-green mb-1">
          <Map size={14} />
          <span className="font-medium">Quant learning path</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Your Roadmap</h1>
        <p className="mt-2 text-muted">
          {roadmap.length ? `${completedCount + inProgressCount} of ${roadmap.length} topics in this path` : "Generate or update your roadmap below."}
          {roadmapId && <span className="block text-xs text-muted mt-1">ID: {roadmapId.slice(0, 8)}…</span>}
        </p>
      </div>

      {/* Update vs Create — two clear actions */}
      <div className="mb-10 flex flex-col gap-6">
        <div className="glass-card p-5 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Wand2 size={15} className="text-dallas-green" />
            Update current roadmap
          </h3>
          <p className="text-xs text-muted">
            Refine this roadmap with a prompt (e.g. &quot;Focus on options pricing&quot; or &quot;Add more on risk management&quot;). The ML pipeline + Gemini will adjust recommendations.
          </p>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder='e.g. "I want to focus on Black-Scholes and volatility" or "Add stochastic calculus next"'
            rows={3}
            className="w-full rounded-xl border border-surface-border bg-background/50 px-4 py-3 text-sm text-foreground placeholder:text-muted-dark focus:border-dallas-green focus:outline-none focus:ring-1 focus:ring-dallas-green/40 transition-all resize-none"
          />
          <button
            onClick={handleUpdateRoadmap}
            disabled={updateBusy || !userId}
            className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white bg-dallas-green hover:bg-dallas-green-dark disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {updateBusy ? <><RefreshCw size={15} className="animate-spin" /> Updating…</> : <><Wand2 size={15} /> Update roadmap</>}
          </button>
        </div>

        <div className="glass-card p-5 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <PlusCircle size={15} className="text-dallas-green" />
            Create new roadmap
          </h3>
          <p className="text-xs text-muted">
            Start a new learning path for a different quant area (e.g. fixed income, algo trading). This creates a new roadmap with a new ID; your progress is preserved.
          </p>
          <button
            onClick={roadmap.length === 0 ? handleGenerateFirst : handleCreateNewRoadmap}
            disabled={createBusy || !userId}
            className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {createBusy ? <><RefreshCw size={15} className="animate-spin" /> Creating…</> : <><PlusCircle size={15} /> {roadmap.length === 0 ? "Generate first roadmap" : "Create new roadmap"}</>}
          </button>
        </div>
      </div>

      {/* Progress card */}
      {roadmap.length > 0 && (
        <div className="mb-10 flex flex-col lg:flex-row gap-4 items-start">
          <div className="glass-card p-5 flex items-center gap-6">
            <CircularProgress percent={percent} />
            <div className="space-y-2 text-sm">
              {[
                { label: "Completed", count: completedCount, dot: "bg-emerald-500" },
                { label: "In Progress", count: inProgressCount, dot: "bg-yellow-400" },
                { label: "Upcoming", count: roadmap.length - completedCount - inProgressCount, dot: "bg-zinc-500" },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-2">
                  <div className={`h-2.5 w-2.5 rounded-full ${s.dot}`} />
                  <span className="text-muted text-xs">{s.label}</span>
                  <span className="font-bold text-xs ml-auto">{s.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      {roadmap.length > 0 && (
        <div className="mb-6 flex items-center gap-6 px-1">
          {[
            { label: "Completed", bg: "#dcfce7", border: "#16a34a" },
            { label: "In Progress", bg: "#fef9c3", border: "#ca8a04" },
            { label: "Upcoming", bg: "#f3f4f6", border: "#6b7280" },
          ].map((l) => (
            <div key={l.label} className="flex items-center gap-2">
              <div className="h-5 w-12 rounded-md border-2" style={{ background: l.bg, borderColor: l.border }} />
              <span className="text-xs font-bold text-foreground">{l.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Roadmap flow or empty state */}
      {roadmap.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-surface-border bg-surface/50 p-12 text-center text-muted">
          <p className="text-sm">No roadmap yet. Use &quot;Generate first roadmap&quot; or &quot;Create new roadmap&quot; above. The RIQE pipeline will build a quant-focused path and Gemini will add suggestions and YouTube queries.</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-0 overflow-x-auto pb-12">
          {roadmap.map((topic, i) => (
            <div key={topic.id} className="flex flex-col items-center w-full">
              <RoadmapRow
                topic={topic}
                onSelect={setSelectedTopic}
                rowRef={(el) => { nodeRefs.current[i] = el; }}
              />
              {i < roadmap.length - 1 && <DownArrow green={topic.status === "completed"} />}
            </div>
          ))}
        </div>
      )}

      <TopicModal
        topic={selectedTopic ? { id: selectedTopic.id, title: selectedTopic.title, description: selectedTopic.description, status: selectedTopic.status } : null}
        onClose={() => setSelectedTopic(null)}
        onNavigate={handleNavigate}
        suggestions={selectedTopic?.suggestions}
        youtubeQueries={selectedTopic?.youtube_queries}
      />

      {errorToast && (
        <div className="fixed bottom-6 right-6 z-[200] flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-950/90 px-5 py-3 text-sm text-red-200 shadow-2xl backdrop-blur-sm animate-slide-in-right">
          <span className="text-red-400 text-base">⚠</span>
          {errorToast}
        </div>
      )}
      {successToast && (
        <div className="fixed bottom-6 right-6 z-[200] flex items-center gap-3 rounded-xl border border-dallas-green/30 bg-dallas-green/20 px-5 py-3 text-sm text-foreground shadow-2xl backdrop-blur-sm animate-slide-in-right">
          <span className="text-dallas-green text-base">✓</span>
          {successToast}
        </div>
      )}
    </div>
  );
}
