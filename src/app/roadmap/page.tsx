"use client";

import { useState, useEffect, useRef } from "react";
import {
  Map, Wand2, RefreshCw, PlusCircle, Loader2, Info, Cpu, Sparkles,
  CheckCircle2, Clock, Circle, ChevronDown, X, History,
} from "lucide-react";
import TopicModal from "@/components/TopicModal";
import { useProfileData } from "@/hooks/useProfileData";
import {
  riqeOnboard,
  riqeUpdateRoadmap,
  riqeCreateNewRoadmap,
  type RoadmapResponse,
  type RoadmapNode,
} from "@/lib/riqe";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RoadmapTopicUI {
  id: string;
  title: string;
  description: string;
  status: "completed" | "in-progress" | "upcoming";
  suggestions?: string[];
  youtube_queries?: string[];
}

interface Phase {
  id: string;
  title: string;
  index: number;
  topics: RoadmapTopicUI[];
}

interface RoadmapHistoryEntry {
  id: string;
  roadmapId: string;
  topics: RoadmapTopicUI[];
  savedAt: string;
  topicCount: number;
  completedCount: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toTopic(node: RoadmapNode, index: number): RoadmapTopicUI {
  return {
    id: node.topic_id,
    title: node.title,
    description: node.description,
    status: index === 0 ? "in-progress" : "upcoming",
    suggestions: node.suggestions,
    youtube_queries: node.youtube_queries,
  };
}

const PHASE_SIZE  = 4;
const PHASE_NAMES = ["Getting Started", "Core Foundations", "Applied Concepts", "Advanced Topics", "Specialization"];

function groupIntoPhases(topics: RoadmapTopicUI[]): Phase[] {
  const phases: Phase[] = [];
  for (let i = 0; i < topics.length; i += PHASE_SIZE) {
    const idx = Math.floor(i / PHASE_SIZE);
    phases.push({ id: `phase-${idx}`, title: PHASE_NAMES[idx] ?? `Phase ${idx + 1}`, index: idx, topics: topics.slice(i, i + PHASE_SIZE) });
  }
  return phases;
}

function nextStatus(s: "completed" | "in-progress" | "upcoming"): "completed" | "in-progress" | "upcoming" {
  if (s === "upcoming") return "in-progress";
  if (s === "in-progress") return "completed";
  return "upcoming";
}

function derivePhaseStatus(topics: RoadmapTopicUI[]): "completed" | "in-progress" | "upcoming" {
  if (topics.every(t => t.status === "completed")) return "completed";
  if (topics.some(t => t.status !== "upcoming")) return "in-progress";
  return "upcoming";
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const PHASE_STYLES = [
  { border: "#3b82f6", bg: "rgba(59,130,246,0.07)",  text: "#93c5fd", dot: "#3b82f6" },
  { border: "#a855f7", bg: "rgba(168,85,247,0.07)",  text: "#d8b4fe", dot: "#a855f7" },
  { border: "#10b981", bg: "rgba(16,185,129,0.07)",  text: "#6ee7b7", dot: "#10b981" },
  { border: "#f59e0b", bg: "rgba(245,158,11,0.07)",  text: "#fcd34d", dot: "#f59e0b" },
  { border: "#f43f5e", bg: "rgba(244,63,94,0.07)",   text: "#fda4af", dot: "#f43f5e" },
];

function statusCfg(s: string) {
  if (s === "completed")   return { label: "Done",        Icon: CheckCircle2, color: "#10b981", bg: "rgba(16,185,129,0.12)",  border: "rgba(16,185,129,0.4)"  };
  if (s === "in-progress") return { label: "In Progress", Icon: Clock,        color: "#eab308", bg: "rgba(234,179,8,0.12)",   border: "rgba(234,179,8,0.4)"   };
  return                          { label: "Upcoming",    Icon: Circle,       color: "#71717a", bg: "rgba(113,113,122,0.12)", border: "rgba(113,113,122,0.4)" };
}

// ─── Topic card (leaf node) ───────────────────────────────────────────────────

function TopicCard({
  topic, phaseColor, onOpen, onToggle, readOnly,
}: {
  topic: RoadmapTopicUI;
  phaseColor: string;
  onOpen: () => void;
  onToggle: (e: React.MouseEvent) => void;
  readOnly?: boolean;
}) {
  const sc = statusCfg(topic.status);
  const { Icon } = sc;
  const activeBorder = topic.status === "completed" ? "#10b981" : topic.status === "in-progress" ? "#eab308" : phaseColor + "55";

  return (
    <div
      onClick={onOpen}
      className="relative rounded-xl border p-3.5 cursor-pointer group transition-all duration-200 hover:scale-[1.02] hover:shadow-xl w-full"
      style={{
        borderColor: activeBorder,
        background: topic.status === "in-progress" ? "rgba(234,179,8,0.05)" : topic.status === "completed" ? "rgba(16,185,129,0.04)" : "rgba(24,24,27,0.85)",
        boxShadow: topic.status === "in-progress" ? `0 0 18px rgba(234,179,8,0.12)` : undefined,
      }}
    >
      {/* Status badge – click to cycle */}
      <button
        onClick={readOnly ? undefined : onToggle}
        title={readOnly ? undefined : "Click to change status"}
        className="absolute top-2 right-2 flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold transition-opacity hover:opacity-75"
        style={{ background: sc.bg, borderColor: sc.border, color: sc.color, cursor: readOnly ? "default" : "pointer" }}
        disabled={readOnly}
      >
        <Icon size={9} />
        {sc.label}
      </button>

      <p className="text-sm font-semibold leading-snug pr-20">{topic.title}</p>
      <p className="mt-1 text-[11px] text-muted leading-relaxed line-clamp-2">{topic.description}</p>
      <p className="mt-2 text-[10px] text-muted-dark group-hover:text-dallas-green transition-colors">
        Open for resources &rarr;
      </p>
    </div>
  );
}

// ─── Phase section (tree node + branches) ────────────────────────────────────

function PhaseSection({
  phase, isLast, onOpenTopic, onToggleTopic, readOnly,
}: {
  phase: Phase;
  isLast: boolean;
  onOpenTopic: (t: RoadmapTopicUI) => void;
  onToggleTopic: (id: string) => void;
  readOnly?: boolean;
}) {
  const style  = PHASE_STYLES[phase.index % PHASE_STYLES.length];
  const nextSt = PHASE_STYLES[(phase.index + 1) % PHASE_STYLES.length];
  const ps     = derivePhaseStatus(phase.topics);
  const psc    = statusCfg(ps);
  const { Icon: PIcon } = psc;
  const done   = phase.topics.filter(t => t.status === "completed").length;

  // cols: how many columns the grid should have (max 4, balanced)
  const n    = phase.topics.length;
  const cols = n <= 2 ? n : n === 3 ? 3 : 4;
  // trunk inset: the horizontal line should span from ~center of first col to ~center of last col
  const inset = `${(1 / (2 * cols)) * 100}%`;

  return (
    <div className="w-full flex flex-col items-center animate-fade-in" style={{ animationDelay: `${phase.index * 0.06}s` }}>

      {/* ── Phase header node ── */}
      <div
        className="rounded-2xl border px-6 py-3"
        style={{ borderColor: style.border + "60", background: style.bg }}
      >
        <div className="flex items-center gap-2 flex-wrap justify-center">
          <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: style.dot }} />
          <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: style.text }}>
            Phase {phase.index + 1}
          </span>
          <span className="font-bold text-sm text-foreground">&mdash; {phase.title}</span>
          <span
            className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold"
            style={{ color: psc.color, background: psc.bg, borderColor: psc.border }}
          >
            <PIcon size={9} />{done}/{n}
          </span>
        </div>
      </div>

      {/* ── Vertical drop from header to trunk ── */}
      <div className="w-0.5 h-5" style={{ background: style.border + "60" }} />

      {/* ── Trunk + stems + topic cards ── */}
      <div className="w-full relative">
        {/* Horizontal trunk line */}
        <div
          className="absolute top-0 h-0.5 z-0"
          style={{ left: inset, right: inset, background: `linear-gradient(to right, ${style.border}20, ${style.border}60 20%, ${style.border}60 80%, ${style.border}20)` }}
        />

        {/* Topic columns */}
        <div
          className="grid gap-3 relative z-10"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {phase.topics.map((topic) => (
            <div key={topic.id} className="flex flex-col items-center">
              {/* Stem from trunk down */}
              <div className="w-0.5 h-5 flex-shrink-0" style={{ background: style.border + "60" }} />
              {/* Branch dot */}
              <div className="w-2 h-2 rounded-full flex-shrink-0 -mt-1 mb-1.5 ring-2 ring-background" style={{ background: style.dot }} />
              {/* Leaf topic card */}
              <TopicCard
                topic={topic}
                phaseColor={style.border}
                onOpen={() => onOpenTopic(topic)}
                onToggle={(e) => { e.stopPropagation(); onToggleTopic(topic.id); }}
                readOnly={readOnly}
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── Connector to next phase ── */}
      {!isLast && (
        <div className="flex flex-col items-center mt-2 mb-0">
          <div
            className="w-0.5 h-8"
            style={{ background: `linear-gradient(to bottom, ${style.border}60, ${nextSt.border}60)` }}
          />
          <ChevronDown size={14} className="-mt-1" style={{ color: nextSt.border + "90" }} />
        </div>
      )}
    </div>
  );
}

// ─── Pipeline info banner ─────────────────────────────────────────────────────

function PipelineInfoBanner() {
  const [open, setOpen] = useState(false);
  return (
    <div className="glass-card p-4 mb-6">
      <button onClick={() => setOpen(v => !v)} className="flex items-center gap-2 w-full text-left">
        <Info size={14} className="text-dallas-green flex-shrink-0" />
        <span className="text-xs font-semibold">How your roadmap is generated</span>
        <span className="ml-auto text-[10px] text-muted">{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <div className="mt-3 space-y-3 text-xs text-muted leading-relaxed">
          <div className="flex gap-2">
            <Cpu size={12} className="text-dallas-green mt-0.5 flex-shrink-0" />
            <div>
              <span className="font-semibold text-foreground">Local ML pipeline (RIQE)</span>
              <p className="mt-0.5">Three PyTorch models run in a local Python subprocess &mdash; UserProfileMLP, RIQESignalClassifier, and TrendGRU &mdash; with sentence-transformers (all-MiniLM-L6-v2) for 384-dim embeddings. Topics are scored by cosine similarity to your user vector, signal strength, and trend, then ordered by a prerequisite DAG across 15 quant finance domains.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Sparkles size={12} className="text-purple-400 mt-0.5 flex-shrink-0" />
            <div>
              <span className="font-semibold text-foreground">Gemini enrichment</span>
              <p className="mt-0.5">The full ML output is sent to Gemini 1.5 Flash, which generates &quot;Next / Resource / Watch&quot; suggestions and YouTube search queries per topic. Requires <code className="bg-surface px-1 rounded">GEMINI_API_KEY</code>.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Info size={12} className="text-muted mt-0.5 flex-shrink-0" />
            <div>
              <span className="font-semibold text-foreground">Context you provide</span>
              <p className="mt-0.5">Text you enter is embedded and classified by the local models as a learning signal, updating your knowledge state before the roadmap is rebuilt.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Progress ring ────────────────────────────────────────────────────────────

function CircularProgress({ percent }: { percent: number }) {
  const r = 54, circ = 2 * Math.PI * r;
  return (
    <div className="relative w-28 h-28 flex-shrink-0">
      <svg viewBox="0 0 124 124" className="w-full h-full -rotate-90">
        <circle cx="62" cy="62" r={r} fill="none" stroke="#27272a" strokeWidth="10" />
        <circle cx="62" cy="62" r={r} fill="none" stroke="#46b533" strokeWidth="10" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - percent / 100)}
          style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(.22,.68,0,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold">{percent}%</span>
        <span className="text-[10px] text-muted">done</span>
      </div>
    </div>
  );
}

// ─── History panel ────────────────────────────────────────────────────────────

function HistoryPanel({
  entries, open, onClose, onSelect, onDelete,
}: {
  entries: RoadmapHistoryEntry[];
  open: boolean;
  onClose: () => void;
  onSelect: (entry: RoadmapHistoryEntry) => void;
  onDelete: (entryId: string) => void;
}) {
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed right-0 top-0 z-50 flex h-screen w-full max-w-sm flex-col border-l border-surface-border bg-surface shadow-2xl shadow-black/50 animate-slide-in-right">
        <div className="flex items-center justify-between border-b border-surface-border px-6 py-5">
          <div>
            <h2 className="text-lg font-bold">Previous Roadmaps</h2>
            <p className="text-xs text-muted mt-1">{entries.length} saved</p>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-muted hover:bg-surface-hover hover:text-foreground transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {entries.length === 0 ? (
            <p className="text-sm text-muted text-center py-8">No previous roadmaps yet.</p>
          ) : entries.map(entry => (
            <div
              key={entry.id}
              className="glass-card p-4 cursor-pointer hover:border-dallas-green/40 transition-colors group"
              onClick={() => { onSelect(entry); onClose(); }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold">
                    Roadmap {entry.roadmapId.slice(0, 8)}...
                  </p>
                  <p className="text-xs text-muted mt-1">
                    {entry.topicCount} topics &middot; {entry.completedCount} completed
                  </p>
                  <p className="text-[10px] text-muted-dark mt-1">
                    {new Date(entry.savedAt).toLocaleDateString()} at{" "}
                    {new Date(entry.savedAt).toLocaleTimeString()}
                  </p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(entry.id); }}
                  className="text-muted-dark opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all p-1"
                  title="Remove from history"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ─── Storage ──────────────────────────────────────────────────────────────────

const STORAGE_KEY     = "luminary_roadmap";
const STORAGE_ID_KEY  = "luminary_roadmap_id";
const HISTORY_KEY     = "luminary_roadmap_history";
const MAX_HISTORY     = 10;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RoadmapPage() {
  const { userId, skillsGained, loading: profileLoading } = useProfileData();

  const [roadmap,       setRoadmap]       = useState<RoadmapTopicUI[]>([]);
  const [roadmapId,     setRoadmapId]     = useState<string | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<RoadmapTopicUI | null>(null);

  const [prompt,       setPrompt]       = useState("");
  const [newCtx,       setNewCtx]       = useState("");
  const [updateBusy,   setUpdateBusy]   = useState(false);
  const [createBusy,   setCreateBusy]   = useState(false);
  const [errorToast,   setErrorToast]   = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // history
  const [history,              setHistory]              = useState<RoadmapHistoryEntry[]>([]);
  const [historyOpen,          setHistoryOpen]          = useState(false);
  const [viewingHistoryEntry,  setViewingHistoryEntry]  = useState<RoadmapHistoryEntry | null>(null);

  // scroll ref
  const treeRef = useRef<HTMLDivElement>(null);

  // persistence
  const saveAndSet = (topics: RoadmapTopicUI[], id: string) => {
    setRoadmap(topics);
    setRoadmapId(id);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(topics)); localStorage.setItem(STORAGE_ID_KEY, id); } catch {}
  };
  const persistRoadmap = (res: RoadmapResponse) => saveAndSet(res.nodes.map((n, i) => toTopic(n, i)), res.roadmap_id);

  const scrollToTree = () => {
    setTimeout(() => {
      treeRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
  };

  // history helpers
  const loadHistory = (): RoadmapHistoryEntry[] => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  };

  const saveHistory = (entries: RoadmapHistoryEntry[]) => {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY))); } catch {}
  };

  const pushToHistory = (topics: RoadmapTopicUI[], rmId: string) => {
    if (topics.length === 0 || !rmId) return;
    const entry: RoadmapHistoryEntry = {
      id: crypto.randomUUID?.() ?? `hist-${Date.now()}`,
      roadmapId: rmId,
      topics: JSON.parse(JSON.stringify(topics)),
      savedAt: new Date().toISOString(),
      topicCount: topics.length,
      completedCount: topics.filter(t => t.status === "completed").length,
    };
    const updated = [entry, ...history].slice(0, MAX_HISTORY);
    setHistory(updated);
    saveHistory(updated);
  };

  const deleteFromHistory = (entryId: string) => {
    const updated = history.filter(e => e.id !== entryId);
    setHistory(updated);
    saveHistory(updated);
    if (viewingHistoryEntry?.id === entryId) setViewingHistoryEntry(null);
  };

  // load on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const id  = localStorage.getItem(STORAGE_ID_KEY);
      if (raw && id) {
        const parsed = JSON.parse(raw) as RoadmapTopicUI[];
        if (Array.isArray(parsed) && parsed.length > 0) { setRoadmap(parsed); setRoadmapId(id); }
      }
    } catch {}
    setHistory(loadHistory());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // status toggle
  const toggleTopicStatus = (topicId: string) => {
    setRoadmap(prev => {
      const updated = prev.map(t => t.id === topicId ? { ...t, status: nextStatus(t.status) } : t);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  // toasts
  const showError   = (msg: string) => { setErrorToast(msg);   setTimeout(() => setErrorToast(null),   4000); };
  const showSuccess = (msg: string) => { setSuccessToast(msg); setTimeout(() => setSuccessToast(null), 3000); };

  // handlers
  const handleUpdate = async () => {
    if (!prompt.trim() || !userId) { showError("Enter a prompt and make sure you are signed in."); return; }
    setUpdateBusy(true);
    try {
      persistRoadmap(await riqeUpdateRoadmap(userId, prompt.trim()));
      setPrompt("");
      showSuccess("Roadmap updated.");
      setViewingHistoryEntry(null);
      scrollToTree();
    }
    catch (e) { showError(e instanceof Error ? e.message : "Update failed"); }
    finally { setUpdateBusy(false); }
  };

  const handleCreateNew = async () => {
    if (!userId) { showError("Not signed in."); return; }
    setCreateBusy(true);
    try {
      if (newCtx.trim()) await riqeUpdateRoadmap(userId, newCtx.trim());
      // archive current roadmap before replacing
      if (roadmap.length > 0 && roadmapId) pushToHistory(roadmap, roadmapId);
      const res = await riqeCreateNewRoadmap(userId, crypto.randomUUID?.() ?? `rm-${Date.now()}`);
      persistRoadmap(res.roadmap);
      setNewCtx("");
      showSuccess("New roadmap created.");
      setViewingHistoryEntry(null);
      scrollToTree();
    } catch (e) { showError(e instanceof Error ? e.message : "Create failed. You may need to onboard first."); }
    finally { setCreateBusy(false); }
  };

  const handleGenerateFirst = async () => {
    if (!userId) { showError("Not signed in."); return; }
    setCreateBusy(true);
    try {
      // defensive: archive if there's somehow an existing roadmap
      if (roadmap.length > 0 && roadmapId) pushToHistory(roadmap, roadmapId);
      const rawSkills = skillsGained ?? {};
      const skillScores: Record<string, number> = Object.keys(rawSkills).length > 0
        ? Object.fromEntries(Object.entries(rawSkills).map(([k, v]) => [k, Math.min(1, Math.max(0, Number(v) / 4))]))
        : { math: 0.5, programming: 0.5, finance: 0.5 };
      const ctx = newCtx.trim();
      const res = await riqeOnboard({
        user_id: userId,
        resume_text:    ctx || "Quantitative finance: derivatives, risk, statistics, and programming.",
        skill_scores:   skillScores,
        interests:      ctx ? [ctx] : ["derivatives", "risk management", "quantitative finance"],
        field_of_study: "Quantitative Finance",
        timeframe_weeks: 12,
      });
      persistRoadmap(res.roadmap);
      setNewCtx("");
      showSuccess("Your first quant roadmap is ready.");
      setViewingHistoryEntry(null);
      scrollToTree();
    } catch (e) { showError(e instanceof Error ? e.message : "Generate failed"); }
    finally { setCreateBusy(false); }
  };

  const handleNavigate = (topicId: string) => {
    const source = viewingHistoryEntry ? viewingHistoryEntry.topics : roadmap;
    const t = source.find(r => r.id === topicId);
    if (t) setSelectedTopic(t); else showError("Topic not found.");
  };

  // derived — use history entry if viewing one, otherwise current roadmap
  const displayTopics   = viewingHistoryEntry ? viewingHistoryEntry.topics : roadmap;
  const completedCount  = displayTopics.filter(t => t.status === "completed").length;
  const inProgressCount = displayTopics.filter(t => t.status === "in-progress").length;
  const percent = displayTopics.length ? Math.round(((completedCount + inProgressCount * 0.5) / displayTopics.length) * 100) : 0;
  const phases  = groupIntoPhases(displayTopics);
  const isViewingHistory = viewingHistoryEntry !== null;

  if (profileLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-dallas-green" />
    </div>
  );

  return (
    <div className="min-h-screen px-4 py-8 md:px-8">
      {/* Header */}
      <div className="mb-8 animate-fade-in">
        <div className="flex items-center gap-2 text-sm text-dallas-green mb-1">
          <Map size={14} />
          <span className="font-medium">Quant learning path</span>
        </div>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Your Roadmap</h1>
            <p className="mt-2 text-muted text-sm">
              {displayTopics.length ? `${completedCount + inProgressCount} of ${displayTopics.length} topics in progress` : "Generate your personalised quant roadmap below."}
              {!isViewingHistory && roadmapId && <span className="block text-xs text-muted-dark mt-1">ID: {roadmapId.slice(0, 8)}&hellip;</span>}
            </p>
          </div>
          {history.length > 0 && (
            <button
              onClick={() => setHistoryOpen(true)}
              className="flex items-center gap-2 rounded-xl border border-surface-border bg-surface px-3 py-2 text-xs font-medium text-muted hover:text-foreground hover:border-dallas-green transition-all"
            >
              <History size={14} />
              Previous Roadmaps ({history.length})
            </button>
          )}
        </div>
      </div>

      <PipelineInfoBanner />

      {/* Action cards */}
      <div className="mb-10 flex flex-col gap-5">
        <div className="glass-card p-5 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2"><Wand2 size={15} className="text-dallas-green" />Update current roadmap</h3>
          <p className="text-xs text-muted">Enter a prompt &mdash; your text is classified by the local RIQESignalClassifier, updates your knowledge state, and the roadmap is rebuilt. Gemini re-enriches all topics.</p>
          <textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder='e.g. "I want to focus on Black-Scholes and volatility"' rows={3}
            className="w-full rounded-xl border border-surface-border bg-background/50 px-4 py-3 text-sm placeholder:text-muted-dark focus:border-dallas-green focus:outline-none focus:ring-1 focus:ring-dallas-green/40 transition-all resize-none" />
          <button onClick={handleUpdate} disabled={updateBusy || !userId}
            className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white bg-dallas-green hover:bg-dallas-green-dark disabled:opacity-50 disabled:cursor-not-allowed transition-all">
            {updateBusy ? <><RefreshCw size={15} className="animate-spin" />Updating&hellip;</> : <><Wand2 size={15} />Update roadmap</>}
          </button>
        </div>

        <div className="glass-card p-5 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2"><PlusCircle size={15} className="text-dallas-green" />{roadmap.length === 0 ? "Generate your roadmap" : "Create new roadmap"}</h3>
          <p className="text-xs text-muted">{roadmap.length === 0 ? "Describe your background or goals — the local ML pipeline uses this as profile context to build your tree." : "Start a fresh path for a different quant area. Your current roadmap will be saved to history."}</p>
          <textarea value={newCtx} onChange={e => setNewCtx(e.target.value)}
            placeholder={roadmap.length === 0 ? 'e.g. "I have a stats background and want to learn derivatives pricing"' : 'e.g. "Focus on algorithmic trading" (optional)'}
            rows={3} className="w-full rounded-xl border border-surface-border bg-background/50 px-4 py-3 text-sm placeholder:text-muted-dark focus:border-dallas-green focus:outline-none focus:ring-1 focus:ring-dallas-green/40 transition-all resize-none" />
          <p className="text-[11px] text-muted-dark flex items-center gap-1"><Cpu size={11} />Embedded locally &rarr; classified by RIQE signal model &rarr; context passed to Gemini.</p>
          <button onClick={roadmap.length === 0 ? handleGenerateFirst : handleCreateNew} disabled={createBusy || !userId}
            className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
            {createBusy ? <><RefreshCw size={15} className="animate-spin" />{roadmap.length === 0 ? "Generating\u2026" : "Creating\u2026"}</> : <><PlusCircle size={15} />{roadmap.length === 0 ? "Generate roadmap" : "Create new roadmap"}</>}
          </button>
        </div>
      </div>

      {/* History view banner */}
      {isViewingHistory && (
        <div className="mb-6 glass-card p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History size={14} className="text-muted" />
            <span className="text-sm text-muted">
              Viewing roadmap from {new Date(viewingHistoryEntry.savedAt).toLocaleDateString()} &mdash; {viewingHistoryEntry.topicCount} topics
            </span>
          </div>
          <button
            onClick={() => setViewingHistoryEntry(null)}
            className="text-xs font-semibold text-dallas-green hover:underline"
          >
            Back to current roadmap
          </button>
        </div>
      )}

      {/* Progress */}
      {displayTopics.length > 0 && (
        <div className="mb-8 glass-card p-5 flex items-center gap-6">
          <CircularProgress percent={percent} />
          <div className="space-y-2 text-sm">
            {[{ label: "Completed", count: completedCount, color: "#10b981" }, { label: "In Progress", count: inProgressCount, color: "#eab308" }, { label: "Upcoming", count: displayTopics.length - completedCount - inProgressCount, color: "#71717a" }].map(s => (
              <div key={s.label} className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                <span className="text-muted text-xs">{s.label}</span>
                <span className="font-bold text-xs ml-auto">{s.count}</span>
              </div>
            ))}
          </div>
          <div className="ml-auto hidden md:block text-xs text-muted-dark">
            {isViewingHistory ? "Read-only \u2014 viewing a previous roadmap." : "Click a topic\u2019s badge to mark progress."}
          </div>
        </div>
      )}

      {/* Tree roadmap */}
      {displayTopics.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-surface-border bg-surface/50 p-12 text-center text-muted">
          <p className="text-sm">No roadmap yet. Add context above and click &quot;Generate roadmap&quot; &mdash; the local RIQE pipeline builds a tree-structured quant learning path.</p>
        </div>
      ) : (
        <div ref={treeRef} className="flex flex-col items-center gap-0 pb-16 max-w-4xl mx-auto">
          {phases.map((phase, i) => (
            <PhaseSection
              key={phase.id}
              phase={phase}
              isLast={i === phases.length - 1}
              onOpenTopic={setSelectedTopic}
              onToggleTopic={toggleTopicStatus}
              readOnly={isViewingHistory}
            />
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

      <HistoryPanel
        entries={history}
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onSelect={setViewingHistoryEntry}
        onDelete={deleteFromHistory}
      />

      {errorToast && (
        <div className="fixed bottom-6 right-6 z-[200] flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-950/90 px-5 py-3 text-sm text-red-200 shadow-2xl backdrop-blur-sm animate-slide-in-right">
          <span className="text-red-400">{"\u26A0"}</span>{errorToast}
        </div>
      )}
      {successToast && (
        <div className="fixed bottom-6 right-6 z-[200] flex items-center gap-3 rounded-xl border border-dallas-green/30 bg-dallas-green/20 px-5 py-3 text-sm text-foreground shadow-2xl backdrop-blur-sm animate-slide-in-right">
          <span className="text-dallas-green">{"\u2713"}</span>{successToast}
        </div>
      )}
    </div>
  );
}
