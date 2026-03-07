"use client";

import { useState } from "react";
import {
  X,
  ExternalLink,
  Play,
  FileText,
  Presentation,
  Lightbulb,
  BookOpen,
  Sparkles,
} from "lucide-react";

interface UpNextItem {
  title: string;
  status: "upcoming" | "in-progress" | "completed";
  match: number;
  topicId: string;
}

interface TopicModalProps {
  topic: {
    id: string;
    title: string;
    description: string;
    status: "completed" | "in-progress" | "upcoming";
  } | null;
  onClose: () => void;
  // Optional: called when user clicks an "Up Next" item to jump to that topic
  onNavigate?: (topicId: string) => void;
}

const youtubeResources = [
  { title: "Understanding the Basics", channel: "Tech Academy", duration: "12:34", views: "1.2M" },
  { title: "Practical Examples & Demos", channel: "Code Master", duration: "18:22", views: "850K" },
  { title: "Deep Dive Tutorial", channel: "Learn Pro", duration: "45:10", views: "2.1M" },
];

const articles = [
  { title: "A Comprehensive Guide", source: "Medium", readTime: "8 min" },
  { title: "Best Practices & Patterns", source: "Dev.to", readTime: "12 min" },
  { title: "Official Documentation", source: "MDN Web Docs", readTime: "5 min" },
];

// ── Per-topic "Up Next" suggestions ──────────────────────────────────────────
// Keys match the real roadmap IDs in roadmap/page.tsx so handleNavigate works.
const upNextMap: Record<string, UpNextItem[]> = {
  // Programming Fundamentals + its subtopics → suggest web basics topics
  fundamentals: [
    { title: "HTML5 & Semantic Markup",   status: "upcoming", match: 96, topicId: "html" },
    { title: "CSS3 & Responsive Design",  status: "upcoming", match: 91, topicId: "css" },
    { title: "JavaScript & DOM",          status: "upcoming", match: 88, topicId: "js-dom" },
  ],
  variables: [
    { title: "Control Flow",              status: "completed", match: 98, topicId: "control-flow" },
    { title: "Functions & Modules",       status: "completed", match: 94, topicId: "functions" },
    { title: "Web Development Basics",    status: "completed", match: 85, topicId: "web-basics" },
  ],
  "control-flow": [
    { title: "Functions & Modules",       status: "completed", match: 97, topicId: "functions" },
    { title: "Object-Oriented Programming", status: "completed", match: 92, topicId: "oop" },
    { title: "HTML5 & Semantic Markup",   status: "upcoming", match: 83, topicId: "html" },
  ],
  functions: [
    { title: "Object-Oriented Programming", status: "completed", match: 96, topicId: "oop" },
    { title: "Web Development Basics",    status: "completed", match: 90, topicId: "web-basics" },
    { title: "React Components & JSX",    status: "completed", match: 82, topicId: "react-basics" },
  ],
  oop: [
    { title: "Web Development Basics",    status: "completed", match: 94, topicId: "web-basics" },
    { title: "State Management",          status: "in-progress", match: 88, topicId: "state" },
    { title: "Data Science Foundations",  status: "upcoming", match: 80, topicId: "data-science" },
  ],

  // Web Basics + its subtopics → suggest frontend framework topics
  "web-basics": [
    { title: "React Components & JSX",    status: "completed", match: 97, topicId: "react-basics" },
    { title: "State Management",          status: "in-progress", match: 92, topicId: "state" },
    { title: "Client-side Routing",       status: "upcoming", match: 87, topicId: "routing" },
  ],
  html: [
    { title: "CSS3 & Responsive Design",  status: "completed", match: 99, topicId: "css" },
    { title: "JavaScript & DOM",          status: "completed", match: 93, topicId: "js-dom" },
    { title: "React Components & JSX",    status: "completed", match: 87, topicId: "react-basics" },
  ],
  css: [
    { title: "JavaScript & DOM",          status: "completed", match: 96, topicId: "js-dom" },
    { title: "Web Accessibility",         status: "completed", match: 90, topicId: "accessibility" },
    { title: "Custom Hooks & Patterns",   status: "upcoming", match: 81, topicId: "hooks" },
  ],
  "js-dom": [
    { title: "React Components & JSX",    status: "completed", match: 98, topicId: "react-basics" },
    { title: "State Management",          status: "in-progress", match: 93, topicId: "state" },
    { title: "Client-side Routing",       status: "upcoming", match: 85, topicId: "routing" },
  ],
  accessibility: [
    { title: "Frontend Frameworks",       status: "in-progress", match: 89, topicId: "frontend-frameworks" },
    { title: "Custom Hooks & Patterns",   status: "upcoming", match: 84, topicId: "hooks" },
    { title: "Data Visualization",        status: "upcoming", match: 72, topicId: "visualization" },
  ],

  // Frontend Frameworks + its subtopics → suggest data science topics
  "frontend-frameworks": [
    { title: "NumPy & Array Computing",   status: "upcoming", match: 88, topicId: "numpy" },
    { title: "Data Science Foundations",  status: "upcoming", match: 83, topicId: "data-science" },
    { title: "Feature Engineering",       status: "upcoming", match: 76, topicId: "feature-eng" },
  ],
  "react-basics": [
    { title: "State Management",          status: "in-progress", match: 98, topicId: "state" },
    { title: "Client-side Routing",       status: "upcoming", match: 91, topicId: "routing" },
    { title: "Custom Hooks & Patterns",   status: "upcoming", match: 86, topicId: "hooks" },
  ],
  state: [
    { title: "Client-side Routing",       status: "upcoming", match: 95, topicId: "routing" },
    { title: "Custom Hooks & Patterns",   status: "upcoming", match: 89, topicId: "hooks" },
    { title: "Data Science Foundations",  status: "upcoming", match: 78, topicId: "data-science" },
  ],
  routing: [
    { title: "Custom Hooks & Patterns",   status: "upcoming", match: 97, topicId: "hooks" },
    { title: "NumPy & Array Computing",   status: "upcoming", match: 84, topicId: "numpy" },
    { title: "Supervised Learning",       status: "upcoming", match: 75, topicId: "supervised" },
  ],
  hooks: [
    { title: "Data Science Foundations",  status: "upcoming", match: 90, topicId: "data-science" },
    { title: "NumPy & Array Computing",   status: "upcoming", match: 85, topicId: "numpy" },
    { title: "Pandas & Data Wrangling",   status: "upcoming", match: 80, topicId: "pandas" },
  ],

  // Data Science + subtopics → suggest ML topics
  "data-science": [
    { title: "Supervised Learning",       status: "upcoming", match: 94, topicId: "supervised" },
    { title: "Feature Engineering",       status: "upcoming", match: 90, topicId: "feature-eng" },
    { title: "Model Evaluation",          status: "upcoming", match: 85, topicId: "model-eval" },
  ],
  numpy: [
    { title: "Pandas & Data Wrangling",   status: "upcoming", match: 98, topicId: "pandas" },
    { title: "Data Visualization",        status: "upcoming", match: 92, topicId: "visualization" },
    { title: "Supervised Learning",       status: "upcoming", match: 83, topicId: "supervised" },
  ],
  pandas: [
    { title: "Data Visualization",        status: "upcoming", match: 96, topicId: "visualization" },
    { title: "Statistical Analysis",      status: "upcoming", match: 90, topicId: "statistics" },
    { title: "Feature Engineering",       status: "upcoming", match: 84, topicId: "feature-eng" },
  ],
  visualization: [
    { title: "Statistical Analysis",      status: "upcoming", match: 94, topicId: "statistics" },
    { title: "Machine Learning",          status: "upcoming", match: 88, topicId: "machine-learning" },
    { title: "Supervised Learning",       status: "upcoming", match: 82, topicId: "supervised" },
  ],
  statistics: [
    { title: "Machine Learning",          status: "upcoming", match: 95, topicId: "machine-learning" },
    { title: "Supervised Learning",       status: "upcoming", match: 91, topicId: "supervised" },
    { title: "Unsupervised Learning",     status: "upcoming", match: 85, topicId: "unsupervised" },
  ],

  // ML + subtopics → suggest deep learning topics
  "machine-learning": [
    { title: "Neural Network Fundamentals", status: "upcoming", match: 93, topicId: "nn-basics" },
    { title: "Feature Engineering",        status: "upcoming", match: 88, topicId: "feature-eng" },
    { title: "Convolutional Networks",     status: "upcoming", match: 81, topicId: "cnn" },
  ],
  supervised: [
    { title: "Unsupervised Learning",     status: "upcoming", match: 96, topicId: "unsupervised" },
    { title: "Model Evaluation",          status: "upcoming", match: 91, topicId: "model-eval" },
    { title: "Neural Network Fundamentals", status: "upcoming", match: 84, topicId: "nn-basics" },
  ],
  unsupervised: [
    { title: "Model Evaluation",          status: "upcoming", match: 95, topicId: "model-eval" },
    { title: "Feature Engineering",       status: "upcoming", match: 90, topicId: "feature-eng" },
    { title: "Neural Network Fundamentals", status: "upcoming", match: 83, topicId: "nn-basics" },
  ],
  "model-eval": [
    { title: "Feature Engineering",       status: "upcoming", match: 94, topicId: "feature-eng" },
    { title: "Neural Network Fundamentals", status: "upcoming", match: 88, topicId: "nn-basics" },
    { title: "Convolutional Networks",    status: "upcoming", match: 80, topicId: "cnn" },
  ],
  "feature-eng": [
    { title: "Neural Network Fundamentals", status: "upcoming", match: 92, topicId: "nn-basics" },
    { title: "Deep Learning & Neural Networks", status: "upcoming", match: 87, topicId: "deep-learning" },
    { title: "Convolutional Networks",    status: "upcoming", match: 82, topicId: "cnn" },
  ],

  // Deep Learning + subtopics → loop back to advanced or related
  "deep-learning": [
    { title: "Convolutional Networks",    status: "upcoming", match: 97, topicId: "cnn" },
    { title: "Recurrent Networks",        status: "upcoming", match: 93, topicId: "rnn" },
    { title: "Transformers & Attention",  status: "upcoming", match: 89, topicId: "transformers" },
  ],
  "nn-basics": [
    { title: "Convolutional Networks",    status: "upcoming", match: 97, topicId: "cnn" },
    { title: "Recurrent Networks",        status: "upcoming", match: 91, topicId: "rnn" },
    { title: "Transformers & Attention",  status: "upcoming", match: 86, topicId: "transformers" },
  ],
  cnn: [
    { title: "Recurrent Networks",        status: "upcoming", match: 95, topicId: "rnn" },
    { title: "Transformers & Attention",  status: "upcoming", match: 91, topicId: "transformers" },
    { title: "Feature Engineering",       status: "upcoming", match: 80, topicId: "feature-eng" },
  ],
  rnn: [
    { title: "Transformers & Attention",  status: "upcoming", match: 97, topicId: "transformers" },
    { title: "Convolutional Networks",    status: "upcoming", match: 88, topicId: "cnn" },
    { title: "Neural Network Fundamentals", status: "upcoming", match: 81, topicId: "nn-basics" },
  ],
  transformers: [
    { title: "Feature Engineering",       status: "upcoming", match: 86, topicId: "feature-eng" },
    { title: "Machine Learning",          status: "upcoming", match: 82, topicId: "machine-learning" },
    { title: "Recurrent Networks",        status: "upcoming", match: 78, topicId: "rnn" },
  ],
};

// Fallback when a topic ID isn't mapped
const fallbackUpNext: UpNextItem[] = [
  { title: "State Management",            status: "in-progress", match: 88, topicId: "state" },
  { title: "Data Science Foundations",    status: "upcoming",    match: 83, topicId: "data-science" },
  { title: "Machine Learning",            status: "upcoming",    match: 77, topicId: "machine-learning" },
];

// ── mini node colours (matches roadmap) ───────────────────────────────────────
function miniNodeStyle(status: string) {
  if (status === "completed")   return { bg: "#dcfce7", border: "#16a34a", text: "#166534" };
  if (status === "in-progress") return { bg: "#fef9c3", border: "#ca8a04", text: "#713f12" };
  return                                { bg: "#1c1c1f", border: "#52525b", text: "#a1a1aa" };
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

export default function TopicModal({ topic, onClose, onNavigate }: TopicModalProps) {
  const [activeTab, setActiveTab] = useState<"resources" | "why" | "next">("resources");

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
                className={`inline-block h-2.5 w-2.5 rounded-full ${
                  topic.status === "completed"
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
              className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                activeTab === tab
                  ? "border-dallas-green text-dallas-green"
                  : "border-transparent text-muted hover:text-foreground"
              }`}
            >
              {tab === "resources" ? "Resources" : tab === "why" ? "Why This?" : "Up Next"}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* ── Resources ── */}
          {activeTab === "resources" && (
            <div className="animate-fade-in space-y-6">
              <p className="text-sm text-muted">{topic.description}</p>

              {/* YouTube */}
              <div>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <Play size={16} className="text-red-400" />
                  Video Resources
                </h3>
                <div className="space-y-3">
                  {youtubeResources.map((vid, i) => (
                    <div
                      key={i}
                      className="group flex items-center gap-4 rounded-xl border border-surface-border bg-background/30 p-4 hover:border-muted-dark transition-colors cursor-pointer"
                    >
                      <div className="flex h-12 w-20 items-center justify-center rounded-lg bg-red-500/10 flex-shrink-0">
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
                      <ExternalLink size={14} className="text-muted-dark flex-shrink-0" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Articles */}
              <div>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <FileText size={16} className="text-blue-400" />
                  Articles
                </h3>
                <div className="space-y-2">
                  {articles.map((article, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-xl border border-surface-border bg-background/30 p-4 hover:border-muted-dark transition-colors cursor-pointer"
                    >
                      <div>
                        <p className="text-sm font-medium">{article.title}</p>
                        <p className="text-xs text-muted-dark">
                          {article.source} • {article.readTime} read
                        </p>
                      </div>
                      <ExternalLink size={14} className="text-muted-dark" />
                    </div>
                  ))}
                </div>
              </div>

              {/* AI PowerPoints */}
              <div>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <Presentation size={16} className="text-dallas-green" />
                  AI-Generated PowerPoints
                </h3>
                <div className="rounded-xl border border-dallas-green/20 bg-dallas-green/5 p-5 text-center">
                  <Sparkles size={28} className="mx-auto mb-3 text-dallas-green" />
                  <p className="text-sm font-semibold">Custom Presentation</p>
                  <p className="mt-1 text-xs text-muted">
                    AI-generated slides tailored to your learning style
                  </p>
                  <button className="mt-4 rounded-lg bg-dallas-green px-4 py-2 text-sm font-semibold text-white hover:bg-dallas-green-dark transition-colors">
                    Generate Slides
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Why This? ── */}
          {activeTab === "why" && (
            <div className="animate-fade-in space-y-6">
              <div className="rounded-xl bg-dallas-green/5 border border-dallas-green/20 p-5">
                <div className="flex items-start gap-3">
                  <Lightbulb size={20} className="text-dallas-green mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Why this topic matters for you</h3>
                    <p className="text-sm text-muted leading-relaxed">
                      Based on your background in{" "}
                      <span className="text-dallas-green font-medium">Python</span> and interest in{" "}
                      <span className="text-dallas-green font-medium">Machine Learning</span>, mastering{" "}
                      <span className="font-medium text-foreground">{topic.title}</span> will strengthen
                      your foundation and unlock advanced topics in your roadmap.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="mb-3 text-sm font-semibold">Connections to Your Profile</h3>
                <div className="space-y-3">
                  {[
                    { field: "Data Science", relation: `${topic.title} is fundamental for building data pipelines and processing large datasets.` },
                    { field: "Web Development", relation: "Full-stack developers regularly use these concepts in production applications." },
                    { field: "Career Goals", relation: "This skill appears in 78% of job listings matching your profile." },
                  ].map((item, i) => (
                    <div key={i} className="rounded-xl border border-surface-border bg-background/30 p-4">
                      <p className="text-xs font-semibold text-dallas-green mb-1">{item.field}</p>
                      <p className="text-sm text-muted">{item.relation}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="mb-3 text-sm font-semibold flex items-center gap-2">
                  <BookOpen size={16} className="text-muted" />
                  How to Learn It Best
                </h3>
                <p className="text-sm text-muted leading-relaxed">
                  Your profile suggests you learn best through{" "}
                  <span className="text-foreground font-medium">hands-on projects</span> and{" "}
                  <span className="text-foreground font-medium">video tutorials</span>. We recommend
                  starting with the video resources above, then building a small project to solidify
                  your understanding. Allocate approximately{" "}
                  <span className="text-dallas-green font-medium">2–3 hours</span> for this topic.
                </p>
              </div>
            </div>
          )}

          {/* ── Up Next ── */}
          {activeTab === "next" && (
            <div className="animate-fade-in">
              <p className="text-sm text-muted mb-6">
                Based on your progress and learning history, here&apos;s what we recommend next:
              </p>

              {/* Roadmap-style chain of upcoming nodes */}
              <div className="flex flex-col items-center">
                {(upNextMap[topic.id] ?? fallbackUpNext).map((item, i) => {
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

                      {/* Arrow between nodes — 3 items total */}
                      {i < 2 && <MiniDownArrow />}
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
