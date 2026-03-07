"use client";

import { useState, useEffect, useRef } from "react";
import { Map, Wand2, RefreshCw } from "lucide-react";
import TopicModal from "@/components/TopicModal";
import { animate, stagger } from "animejs";

interface RoadmapTopic {
  id: string;
  title: string;
  description: string;
  status: "completed" | "in-progress" | "upcoming";
  subtopics: {
    id: string;
    title: string;
    status: "completed" | "in-progress" | "upcoming";
  }[];
}

const defaultRoadmap: RoadmapTopic[] = [
  {
    id: "fundamentals",
    title: "Programming Fundamentals",
    description: "Core programming concepts including variables, types, control flow, and OOP.",
    status: "completed",
    subtopics: [
      { id: "variables", title: "Variables & Data Types", status: "completed" },
      { id: "control-flow", title: "Control Flow", status: "completed" },
      { id: "functions", title: "Functions & Modules", status: "completed" },
      { id: "oop", title: "Object-Oriented Programming", status: "completed" },
    ],
  },
  {
    id: "web-basics",
    title: "Web Development Basics",
    description: "HTML, CSS, responsive design, and JavaScript interactivity.",
    status: "completed",
    subtopics: [
      { id: "html", title: "HTML5 & Semantic Markup", status: "completed" },
      { id: "css", title: "CSS3 & Responsive Design", status: "completed" },
      { id: "js-dom", title: "JavaScript & DOM", status: "completed" },
      { id: "accessibility", title: "Web Accessibility", status: "completed" },
    ],
  },
  {
    id: "frontend-frameworks",
    title: "Frontend Frameworks",
    description: "React, component architecture, state management, and SPA patterns.",
    status: "in-progress",
    subtopics: [
      { id: "react-basics", title: "React Components & JSX", status: "completed" },
      { id: "state", title: "State Management", status: "in-progress" },
      { id: "routing", title: "Client-side Routing", status: "upcoming" },
      { id: "hooks", title: "Custom Hooks & Patterns", status: "upcoming" },
    ],
  },
  {
    id: "data-science",
    title: "Data Science Foundations",
    description: "Statistical analysis, Pandas, and visualization techniques.",
    status: "upcoming",
    subtopics: [
      { id: "numpy", title: "NumPy & Array Computing", status: "upcoming" },
      { id: "pandas", title: "Pandas & Data Wrangling", status: "upcoming" },
      { id: "visualization", title: "Data Visualization", status: "upcoming" },
      { id: "statistics", title: "Statistical Analysis", status: "upcoming" },
    ],
  },
  {
    id: "machine-learning",
    title: "Machine Learning",
    description: "Supervised and unsupervised learning, model evaluation, and pipelines.",
    status: "upcoming",
    subtopics: [
      { id: "supervised", title: "Supervised Learning", status: "upcoming" },
      { id: "unsupervised", title: "Unsupervised Learning", status: "upcoming" },
      { id: "model-eval", title: "Model Evaluation", status: "upcoming" },
      { id: "feature-eng", title: "Feature Engineering", status: "upcoming" },
    ],
  },
  {
    id: "deep-learning",
    title: "Deep Learning & Neural Networks",
    description: "CNNs, RNNs, Transformers, and practical deep learning with PyTorch.",
    status: "upcoming",
    subtopics: [
      { id: "nn-basics", title: "Neural Network Fundamentals", status: "upcoming" },
      { id: "cnn", title: "Convolutional Networks", status: "upcoming" },
      { id: "rnn", title: "Recurrent Networks", status: "upcoming" },
      { id: "transformers", title: "Transformers & Attention", status: "upcoming" },
    ],
  },
];

// ─── Circular Progress Ring ──────────────────────────────────────────────────
function CircularProgress({ percent }: { percent: number }) {
  const r = 54;
  const circ = 2 * Math.PI * r;
  const dashOffset = circ * (1 - percent / 100);
  return (
    <div className="relative w-32 h-32 flex-shrink-0">
      <svg viewBox="0 0 124 124" className="w-full h-full -rotate-90">
        <defs>
          <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="#46b533" />
            <stop offset="50%"  stopColor="#eab308" />
            <stop offset="100%" stopColor="#ef4444" />
          </linearGradient>
        </defs>
        {/* Track */}
        <circle cx="62" cy="62" r={r} fill="none" stroke="#27272a" strokeWidth="10" />
        {/* Filled arc */}
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

// ─── Status color helpers ────────────────────────────────────────────────────
function statusColors(status: string) {
  if (status === "completed")   return { border: "#16a34a", bg: "#dcfce7", text: "#166534", badge: "bg-emerald-500" };
  if (status === "in-progress") return { border: "#ca8a04", bg: "#fef9c3", text: "#713f12", badge: "bg-yellow-400" };
  return                                { border: "#6b7280", bg: "#f3f4f6", text: "#374151", badge: "bg-zinc-400" };
}

// ─── Arrow SVG between boxes ─────────────────────────────────────────────────
function DownArrow({ green }: { green?: boolean }) {
  return (
    <svg width="14" height="28" viewBox="0 0 14 28" className="mx-auto my-0">
      <line x1="7" y1="0" x2="7" y2="20" stroke={green ? "#46b533" : "#52525b"} strokeWidth="2" />
      <polygon points="3,17 7,26 11,17" fill={green ? "#46b533" : "#52525b"} />
    </svg>
  );
}

function RightArrow({ green }: { green?: boolean }) {
  return (
    <svg width="33" height="14" viewBox="0 0 33 14" className="my-auto mx-0 flex-shrink-0">
      <line x1="0" y1="7" x2="24" y2="7" stroke={green ? "#46b533" : "#52525b"} strokeWidth="2" strokeDasharray="4 3" />
      <polygon points="21,3 31,7 21,11" fill={green ? "#46b533" : "#52525b"} />
    </svg>
  );
}

function LeftArrow({ green }: { green?: boolean }) {
  return (
    <svg width="33" height="14" viewBox="0 0 33 14" className="my-auto mx-0 flex-shrink-0">
      <line x1="33" y1="7" x2="9" y2="7" stroke={green ? "#46b533" : "#52525b"} strokeWidth="2" strokeDasharray="4 3" />
      <polygon points="12,3 2,7 12,11" fill={green ? "#46b533" : "#52525b"} />
    </svg>
  );
}

// ─── Single node box ─────────────────────────────────────────────────────────
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

// ─── One full roadmap row (main node + left/right sub-branches) ───────────────
interface RowProps {
  topic: RoadmapTopic;
  onSelect: (t: RoadmapTopic) => void;
  rowRef: (el: HTMLDivElement | null) => void;
}
function RoadmapRow({ topic, onSelect, rowRef }: RowProps) {
  const leftSubs  = topic.subtopics.filter((_, i) => i % 2 === 0);
  const rightSubs = topic.subtopics.filter((_, i) => i % 2 === 1);
  const isComplete = topic.status === "completed";

  return (
    <div ref={rowRef} className="flex items-center justify-center gap-0 w-full opacity-0">
      {/* ── LEFT branches ── */}
      <div className="flex flex-col items-end gap-3 min-w-[160px]">
        {leftSubs.map((sub) => (
          <div key={sub.id} className="flex items-center">
            <NodeBox
              title={sub.title}
              status={sub.status}
              onClick={() => onSelect({ ...topic, title: sub.title, description: `Subtopic of ${topic.title}: ${sub.title}`, status: sub.status })}
            />
            <LeftArrow green={isComplete} />
          </div>
        ))}
      </div>

      {/* ── MAIN node ── */}
      <NodeBox
        title={topic.title}
        status={topic.status}
        size="main"
        onClick={() => onSelect(topic)}
      />

      {/* ── RIGHT branches ── */}
      <div className="flex flex-col items-start gap-3 min-w-[160px]">
        {rightSubs.map((sub) => (
          <div key={sub.id} className="flex items-center">
            <RightArrow green={isComplete} />
            <NodeBox
              title={sub.title}
              status={sub.status}
              onClick={() => onSelect({ ...topic, title: sub.title, description: `Subtopic of ${topic.title}: ${sub.title}`, status: sub.status })}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function RoadmapPage() {
  const [selectedTopic, setSelectedTopic] = useState<RoadmapTopic | null>(null);
  const [roadmap] = useState<RoadmapTopic[]>(defaultRoadmap);
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const nodeRefs = useRef<(HTMLDivElement | null)[]>([]);
  const headerRef = useRef<HTMLDivElement>(null);

  // Navigate to a topic by ID (called from TopicModal Up Next)
  const handleNavigate = (topicId: string) => {
    // Check main topics first
    const mainTopic = roadmap.find((t) => t.id === topicId);
    if (mainTopic) { setSelectedTopic(mainTopic); return; }
    // Check subtopics — wrap in a minimal RoadmapTopic shape for the modal
    for (const topic of roadmap) {
      const sub = topic.subtopics.find((s) => s.id === topicId);
      if (sub) {
        setSelectedTopic({ ...sub, description: `Subtopic of ${topic.title}: ${sub.title}`, subtopics: [] });
        return;
      }
    }
    // Not found
    setErrorToast("Topic not found in your current roadmap.");
    setTimeout(() => setErrorToast(null), 3500);
  };

  const completedCount   = roadmap.filter((t) => t.status === "completed").length;
  const inProgressCount  = roadmap.filter((t) => t.status === "in-progress").length;
  const percent = Math.round(((completedCount + inProgressCount * 0.5) / roadmap.length) * 100);

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
  }, []);

  const handleGenerate = () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    setTimeout(() => setGenerating(false), 1800); // simulated loading
  };

  return (
    <div className="min-h-screen px-4 py-8 md:px-8">
      {/* ── Header ── */}
      <div ref={headerRef} className="mb-8 opacity-0">
        <div className="flex items-center gap-2 text-sm text-dallas-green mb-1">
          <Map size={14} />
          <span className="font-medium">Learning path</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Your Roadmap</h1>
        <p className="mt-2 text-muted">{completedCount} of {roadmap.length} sections completed</p>
      </div>

      {/* ── Top panel: prompt + progress ── */}
      <div className="mb-10 flex flex-col lg:flex-row gap-4 items-start">
        {/* Generate panel */}
        <div className="glass-card p-5 flex-1 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Wand2 size={15} className="text-dallas-green" />
            Customize Roadmap
          </h3>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder='e.g. "I want to remove SVD and add LU Decomposition"'
            rows={3}
            className="w-full rounded-xl border border-surface-border bg-background/50 px-4 py-3 text-sm text-foreground placeholder:text-muted-dark focus:border-dallas-green focus:outline-none focus:ring-1 focus:ring-dallas-green/40 transition-all resize-none"
          />
          <button
            onClick={handleGenerate}
            disabled={generating || !prompt.trim()}
            className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: !prompt.trim() ? "#52525b" : "linear-gradient(135deg, #7c3aed, #6d28d9)",
              boxShadow: !prompt.trim() ? "none" : "0 4px 18px rgba(124,58,237,0.35)",
            }}
          >
            {generating ? (
              <><RefreshCw size={15} className="animate-spin" /> Generating…</>
            ) : (
              <><Wand2 size={15} /> Generate Roadmap</>
            )}
          </button>
        </div>

        {/* Progress card */}
        <div className="glass-card p-5 flex items-center gap-6">
          <CircularProgress percent={percent} />
          <div className="space-y-2 text-sm">
            {[
              { label: "Completed",   count: completedCount,                                   dot: "bg-emerald-500" },
              { label: "In Progress", count: inProgressCount,                                  dot: "bg-yellow-400" },
              { label: "Upcoming",    count: roadmap.length - completedCount - inProgressCount, dot: "bg-zinc-500" },
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

      {/* ── Legend ── */}
      <div className="mb-6 flex items-center gap-6 px-1">
        {[
          { label: "Completed",   bg: "#dcfce7", border: "#16a34a" },
          { label: "In Progress", bg: "#fef9c3", border: "#ca8a04" },
          { label: "Upcoming",    bg: "#f3f4f6", border: "#6b7280" },
        ].map((l) => (
          <div key={l.label} className="flex items-center gap-2">
            <div className="h-5 w-12 rounded-md border-2" style={{ background: l.bg, borderColor: l.border }} />
            <span className="text-xs font-bold text-foreground">{l.label}</span>
          </div>
        ))}
      </div>

      {/* ── Roadmap flow ── */}
      <div className="flex flex-col items-center gap-0 overflow-x-auto pb-12">
        {roadmap.map((topic, i) => {
          const isLast = i === roadmap.length - 1;
          return (
            <div key={topic.id} className="flex flex-col items-center w-full">
              <RoadmapRow
                topic={topic}
                onSelect={setSelectedTopic}
                rowRef={(el) => { nodeRefs.current[i] = el; }}
              />
              {!isLast && <DownArrow green={topic.status === "completed"} />}
            </div>
          );
        })}
      </div>

      <TopicModal
        topic={selectedTopic}
        onClose={() => setSelectedTopic(null)}
        onNavigate={handleNavigate}
      />

      {/* ── Error toast ── */}
      {errorToast && (
        <div className="fixed bottom-6 right-6 z-[200] flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-950/90 px-5 py-3 text-sm text-red-200 shadow-2xl backdrop-blur-sm animate-slide-in-right">
          <span className="text-red-400 text-base">⚠</span>
          {errorToast}
        </div>
      )}
    </div>
  );
}
