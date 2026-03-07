"use client";

import { useState } from "react";
import { Map, CheckCircle2, Circle, ChevronDown } from "lucide-react";
import TopicModal from "@/components/TopicModal";

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

const roadmapData: RoadmapTopic[] = [
  {
    id: "fundamentals",
    title: "Programming Fundamentals",
    description:
      "Core programming concepts including variables, data types, control flow, functions, and object-oriented programming principles.",
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
    description:
      "Foundational web technologies: HTML structure, CSS styling, responsive design, and JavaScript for interactivity.",
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
    description:
      "Modern frontend development with React, component architecture, state management, and building single-page applications.",
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
    description:
      "Statistical analysis, data manipulation with Pandas, visualization techniques, and exploratory data analysis.",
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
    description:
      "Supervised and unsupervised learning algorithms, model evaluation, feature engineering, and practical ML pipeline development.",
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
    description:
      "Neural network architectures, CNNs, RNNs, transformers, and practical deep learning with PyTorch and TensorFlow.",
    status: "upcoming",
    subtopics: [
      { id: "nn-basics", title: "Neural Network Fundamentals", status: "upcoming" },
      { id: "cnn", title: "Convolutional Networks", status: "upcoming" },
      { id: "rnn", title: "Recurrent Networks", status: "upcoming" },
      { id: "transformers", title: "Transformers & Attention", status: "upcoming" },
    ],
  },
];

function StatusIcon({ status }: { status: string }) {
  if (status === "completed")
    return <CheckCircle2 size={20} className="text-dallas-green" />;
  if (status === "in-progress")
    return (
      <div className="relative">
        <Circle size={20} className="text-yellow-400" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-2.5 w-2.5 rounded-full bg-yellow-400 animate-pulse" />
        </div>
      </div>
    );
  return <Circle size={20} className="text-muted-dark" />;
}

export default function RoadmapPage() {
  const [selectedTopic, setSelectedTopic] = useState<RoadmapTopic | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(roadmapData.filter((t) => t.status === "in-progress").map((t) => t.id))
  );

  const toggleExpand = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const completedCount = roadmapData.filter((t) => t.status === "completed").length;

  return (
    <div className="min-h-screen px-4 py-8 md:px-8 lg:px-12">
      {/* Header */}
      <div className="mb-10 animate-fade-in">
        <div className="flex items-center gap-2 text-sm text-dallas-green mb-1">
          <Map size={14} />
          <span className="font-medium">Learning path</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
          Your Roadmap
        </h1>
        <p className="mt-2 text-muted">
          {completedCount} of {roadmapData.length} sections completed
        </p>

        {/* Overall progress */}
        <div className="mt-4 h-2 w-full max-w-md rounded-full bg-surface">
          <div
            className="h-full rounded-full bg-dallas-green animate-progress-fill"
            style={{
              width: `${(completedCount / roadmapData.length) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* Roadmap */}
      <div className="relative mx-auto max-w-2xl">
        {/* Vertical line */}
        <div className="absolute left-7 top-0 bottom-0 w-0.5 bg-surface-border md:left-[39px]" />

        {roadmapData.map((topic, i) => {
          const isExpanded = expandedSections.has(topic.id);
          return (
            <div key={topic.id} className="relative mb-2 animate-fade-in" style={{ animationDelay: `${i * 0.08}s` }}>
              {/* Node */}
              <div
                onClick={() => toggleExpand(topic.id)}
                className={`relative ml-14 md:ml-20 rounded-2xl border p-5 cursor-pointer transition-all duration-300 ${
                  topic.status === "completed"
                    ? "border-dallas-green/30 bg-dallas-green/5 hover:bg-dallas-green/10"
                    : topic.status === "in-progress"
                    ? "border-yellow-400/30 bg-yellow-400/5 hover:bg-yellow-400/10"
                    : "border-surface-border bg-surface/50 hover:bg-surface"
                }`}
              >
                {/* Status dot on the line */}
                <div
                  className={`absolute -left-[calc(3.5rem+5px)] md:-left-[calc(5rem+5px)] top-6 flex h-8 w-8 items-center justify-center rounded-full border-2 bg-background z-10 ${
                    topic.status === "completed"
                      ? "border-dallas-green"
                      : topic.status === "in-progress"
                      ? "border-yellow-400"
                      : "border-surface-border"
                  }`}
                >
                  <StatusIcon status={topic.status} />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold">{topic.title}</h3>
                    <p className="mt-1 text-xs text-muted line-clamp-1">
                      {topic.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTopic(topic);
                      }}
                      className="rounded-lg bg-surface-hover px-3 py-1.5 text-xs font-medium text-muted hover:text-foreground hover:bg-surface-border transition-colors"
                    >
                      Details
                    </button>
                    <ChevronDown
                      size={18}
                      className={`text-muted transition-transform duration-200 ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                    />
                  </div>
                </div>

                {/* Subtopics */}
                {isExpanded && (
                  <div className="mt-4 space-y-2 border-t border-surface-border pt-4 animate-fade-in">
                    {topic.subtopics.map((sub) => (
                      <div
                        key={sub.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTopic({
                            ...topic,
                            title: sub.title,
                            description: `Subtopic of ${topic.title}: ${sub.title}`,
                            status: sub.status,
                          });
                        }}
                        className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-surface-hover transition-colors cursor-pointer"
                      >
                        {/* Dotted connector */}
                        <div className="flex items-center gap-1">
                          <div className="h-px w-3 border-t border-dashed border-muted-dark" />
                        </div>
                        <StatusIcon status={sub.status} />
                        <span
                          className={`text-sm ${
                            sub.status === "completed"
                              ? "text-muted line-through"
                              : sub.status === "in-progress"
                              ? "text-foreground font-medium"
                              : "text-muted"
                          }`}
                        >
                          {sub.title}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Topic Detail Modal */}
      <TopicModal
        topic={selectedTopic}
        onClose={() => setSelectedTopic(null)}
      />
    </div>
  );
}
