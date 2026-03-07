"use client";

import { useState } from "react";
import {
  X,
  ExternalLink,
  Play,
  FileText,
  Presentation,
  Lightbulb,
  ArrowRight,
  BookOpen,
  Sparkles,
  Youtube,
} from "lucide-react";
import YouTubeSnippet from "@/components/YouTubeSnippet";

interface TopicModalProps {
  topic: {
    id: string;
    title: string;
    description: string;
    status: "completed" | "in-progress" | "upcoming";
  } | null;
  onClose: () => void;
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

const upNext = [
  { title: "Advanced Patterns", match: 94 },
  { title: "Testing & Debugging", match: 89 },
  { title: "Performance Optimization", match: 85 },
];

export default function TopicModal({ topic, onClose }: TopicModalProps) {
  const [activeTab, setActiveTab] = useState<"resources" | "why" | "next">("resources");

  if (!topic) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

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
              {tab === "resources"
                ? "Resources"
                : tab === "why"
                  ? "Why This?"
                  : "Up Next"}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
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

          {activeTab === "why" && (
            <div className="animate-fade-in space-y-6">
              <div className="rounded-xl bg-dallas-green/5 border border-dallas-green/20 p-5">
                <div className="flex items-start gap-3">
                  <Lightbulb size={20} className="text-dallas-green mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Why this topic matters for you</h3>
                    <p className="text-sm text-muted leading-relaxed">
                      Based on your background in <span className="text-dallas-green font-medium">Python</span> and
                      interest in <span className="text-dallas-green font-medium">Machine Learning</span>, mastering{" "}
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
                    {
                      field: "Data Science",
                      relation: `${topic.title} is fundamental for building data pipelines and processing large datasets.`,
                    },
                    {
                      field: "Web Development",
                      relation: "Full-stack developers regularly use these concepts in production applications.",
                    },
                    {
                      field: "Career Goals",
                      relation: "This skill appears in 78% of job listings matching your profile.",
                    },
                  ].map((item, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-surface-border bg-background/30 p-4"
                    >
                      <p className="text-xs font-semibold text-dallas-green mb-1">
                        {item.field}
                      </p>
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

          {activeTab === "next" && (
            <div className="animate-fade-in space-y-4">
              <p className="text-sm text-muted mb-4">
                Based on your progress and learning history, here\'s what we recommend next:
              </p>
              {upNext.map((item, i) => (
                <div
                  key={i}
                  className="group flex items-center justify-between rounded-xl border border-surface-border bg-background/30 p-5 hover:border-dallas-green/30 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-dallas-green/10 text-sm font-bold text-dallas-green">
                      {i + 1}
                    </div>
                    <div>
                      <p className="text-sm font-semibold group-hover:text-dallas-green transition-colors">
                        {item.title}
                      </p>
                      <p className="text-xs text-muted-dark">
                        {item.match}% relevance match
                      </p>
                    </div>
                  </div>
                  <ArrowRight
                    size={16}
                    className="text-muted-dark group-hover:text-dallas-green transition-colors"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
