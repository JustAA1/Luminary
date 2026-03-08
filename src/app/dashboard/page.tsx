"use client";

import {
  BookOpen,
  Clock,
  Sparkles,
  TrendingUp,
  ChevronRight,
  Star,
  ArrowRight,
  Zap,
  Loader2,
  Target,
  Calendar,
  Award,
  BarChart3,
  Map,
} from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useProfileData } from "@/hooks/useProfileData";
import type { PastCourseworkItem } from "@/types/database";

// ─── Roadmap localStorage keys (match roadmap page) ──────────────────────────
const STORAGE_KEY = "luminary_roadmap";

interface RoadmapTopicLocal {
  id: string;
  title: string;
  status: "completed" | "in-progress" | "upcoming";
}

function useLocalRoadmap() {
  const [topics, setTopics] = useState<RoadmapTopicLocal[]>([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setTopics(parsed);
      }
    } catch {}
  }, []);
  return topics;
}

export default function HomePage() {
  const {
    fullName,
    hoursLearned,
    currentStreak,
    skillsGained,
    pastCoursework,
    pastCourses,
    roadmapCourseNames,
    overallProgressPercentage,
    topicsDone,
    loading,
    error,
  } = useProfileData();

  const roadmapTopics = useLocalRoadmap();

  const completedTopics = roadmapTopics.filter(t => t.status === "completed");
  const inProgressTopics = roadmapTopics.filter(t => t.status === "in-progress");
  const upcomingTopics = roadmapTopics.filter(t => t.status === "upcoming");
  const roadmapProgress = roadmapTopics.length > 0
    ? Math.round(((completedTopics.length + inProgressTopics.length * 0.5) / roadmapTopics.length) * 100)
    : overallProgressPercentage;

  const allPastCourses: PastCourseworkItem[] = pastCourses.length > 0 ? pastCourses : pastCoursework;

  const skillEntries = Object.entries(skillsGained).sort((a, b) => b[1] - a[1]);
  const skillsCount = skillEntries.length;

  const roadmapCount = roadmapTopics.length > 0 ? 1 : 0;

  const dailyAvg = hoursLearned > 0 ? Math.round((hoursLearned / Math.max(7, currentStreak)) * 10) / 10 : 2.5; // Mock daily avg
  const weights = [0.9, 1.0, 1.1, 0.8, 1.0, 1.3, 0.9];
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const weeklyActivity = days.map((day, i) => ({
    day,
    hours: Math.round(dailyAvg * weights[i] * 10) / 10,
  }));
  const maxHours = Math.max(1, ...weeklyActivity.map(d => d.hours));

  const monthlyWeights = [0.25, 0.45, 0.30];
  const monthlyTopics = ["Jan", "Feb", "Mar"].map((month, i) => ({
    month,
    count: topicsDone > 0 ? Math.round(topicsDone * monthlyWeights[i]) : Math.round(15 * monthlyWeights[i]), // Mock 15 topics
  }));

  const recentAchievements: { title: string; date: string; icon: typeof Map }[] = [];
  if (roadmapCount > 0) recentAchievements.push({ title: "First Roadmap Generated", date: "Feb 2026", icon: Map });
  if (topicsDone >= 1) recentAchievements.push({ title: "First Topic Completed", date: "Feb 2026", icon: Target });
  if (topicsDone >= 5) recentAchievements.push({ title: "5 Topics Completed", date: "Mar 2026", icon: Award });
  if (currentStreak >= 3) recentAchievements.push({ title: `${currentStreak}-Day Streak`, date: "Mar 2026", icon: Zap });
  if (recentAchievements.length === 0) recentAchievements.push({ title: "Getting Started", date: "Mar 2026", icon: Target });

  const upNext = upcomingTopics.length > 0
    ? upcomingTopics.slice(0, 3)
    : [
        { id: "placeholder-1", title: "Generate your first roadmap to see upcoming topics", status: "upcoming" as const },
      ];

  if (loading) {
    return (
      <div className="min-h-screen px-4 py-8 md:px-8 lg:px-12 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-dallas-green" />
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-8 md:px-8 lg:px-12">
      {/* Header */}
      <div className="mb-10 animate-fade-in">
        <div className="flex items-center gap-2 text-sm text-dallas-green mb-1">
          <Sparkles size={14} />
          <span className="font-medium">Quantitative Finance Learning</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
          Welcome back, <span className="text-dallas-green">{fullName || "Learner"}</span>
        </h1>
        <p className="mt-2 text-muted">
          Continue your quant journey — derivatives, risk, stochastic calculus, and more.
        </p>
        {error && (
          <p className="mt-2 text-sm text-amber-500">{error}</p>
        )}
      </div>

      {/* Stats row */}
      <div className="mb-10 grid grid-cols-2 gap-4 md:grid-cols-4 animate-fade-in stagger-1">
        {[
          { label: "Current Roadmaps", value: String(roadmapCount), icon: Map, color: "text-blue-400" },
          { label: "Hours Learned", value: String(hoursLearned), icon: Clock, color: "text-purple-400" },
          { label: "Current Streak", value: `${currentStreak}d`, icon: Zap, color: "text-yellow-400" },
          { label: "Skills Gained", value: String(skillsCount), icon: TrendingUp, color: "text-dallas-green" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-surface-border bg-surface/50 p-5 hover:bg-surface transition-colors"
          >
            <stat.icon size={20} className={`mb-3 ${stat.color}`} />
            <p className="text-2xl font-bold">{stat.value}</p>
            <p className="text-xs text-muted">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Roadmap Progress — connected to actual roadmap */}
      <section className="mb-10 animate-fade-in stagger-2">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Map size={20} className="text-dallas-green" />
            Roadmap Progress
          </h2>
          <Link
            href="/roadmap"
            className="flex items-center gap-1 text-sm text-dallas-green hover:text-dallas-green-light transition-colors"
          >
            View roadmap <ChevronRight size={16} />
          </Link>
        </div>

        {roadmapTopics.length === 0 ? (
          <div className="rounded-2xl border border-surface-border bg-surface/50 border-dashed p-8 text-center text-muted">
            <p className="text-sm">No active roadmap yet. Head to the Roadmap page to generate your personalized quant learning path.</p>
            <Link href="/roadmap" className="mt-3 inline-flex items-center gap-2 rounded-xl bg-dallas-green px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-dallas-green/25 hover:bg-dallas-green-dark transition-all">
              Generate Roadmap <ArrowRight size={16} />
            </Link>
          </div>
        ) : (
          <div className="rounded-2xl border border-surface-border bg-surface/50 p-6">
            <div className="flex items-center gap-6 mb-4">
              {/* Circular progress */}
              <div className="relative w-24 h-24 flex-shrink-0">
                <svg viewBox="0 0 124 124" className="w-full h-full -rotate-90">
                  <circle cx="62" cy="62" r="54" fill="none" stroke="#27272a" strokeWidth="10" />
                  <circle cx="62" cy="62" r="54" fill="none" stroke="#46b533" strokeWidth="10" strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 54}`}
                    strokeDashoffset={`${2 * Math.PI * 54 * (1 - roadmapProgress / 100)}`}
                    style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(.22,.68,0,1)" }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-lg font-bold">{roadmapProgress}%</span>
                  <span className="text-[10px] text-muted">complete</span>
                </div>
              </div>
              <div className="space-y-2 text-sm flex-1">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  <span className="text-muted text-xs">Completed</span>
                  <span className="font-bold text-xs ml-auto">{completedTopics.length}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-yellow-500" />
                  <span className="text-muted text-xs">In Progress</span>
                  <span className="font-bold text-xs ml-auto">{inProgressTopics.length}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-zinc-500" />
                  <span className="text-muted text-xs">Upcoming</span>
                  <span className="font-bold text-xs ml-auto">{upcomingTopics.length}</span>
                </div>
              </div>
            </div>
            <div className="h-2 w-full rounded-full bg-surface-hover">
              <div
                className="h-full rounded-full bg-dallas-green animate-progress-fill"
                style={{ width: `${Math.min(100, roadmapProgress)}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-muted">
              {completedTopics.length} of {roadmapTopics.length} topics completed · {topicsDone} total topics done
            </p>
          </div>
        )}
      </section>

      {/* Skill Breakdown — from Supabase skills_gained */}
      <section className="mb-10 animate-fade-in stagger-2">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <BarChart3 size={20} className="text-purple-400" />
            Skill Breakdown
          </h2>
        </div>

        {skillEntries.length === 0 ? (
          <div className="rounded-2xl border border-surface-border bg-surface/50 border-dashed p-8 text-center text-muted">
            <p className="text-sm">Skills will appear here as you progress through your quant roadmap.</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-surface-border bg-surface/50 p-6 space-y-4">
            {skillEntries.map(([skill, level]) => {
              const pct = Math.min(100, Math.round((level / 4) * 100));
              return (
                <div key={skill}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium capitalize">{skill.replace(/[-_]/g, " ")}</span>
                    <span className="text-xs text-dallas-green font-semibold">{pct}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-surface-hover">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-dallas-green to-dallas-green-light transition-all duration-700"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Weekly Activity */}
      <section className="mb-10 animate-fade-in stagger-3">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Calendar size={20} className="text-blue-400" />
            Weekly Activity
          </h2>
        </div>
        <div className="rounded-2xl border border-surface-border bg-surface/50 p-6">
          <div className="flex items-end gap-3 h-32">
            {weeklyActivity.map((d) => (
              <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full relative" style={{ height: "100px" }}>
                  <div
                    className="absolute bottom-0 w-full rounded-t-lg bg-dallas-green/80 transition-all duration-500"
                    style={{ height: `${(d.hours / maxHours) * 100}%` }}
                  />
                </div>
                <span className="text-[10px] text-muted">{d.day}</span>
                <span className="text-[10px] font-semibold">{d.hours}h</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Two-column: Monthly Topics + Recent Achievements */}
      <div className="mb-10 grid gap-6 md:grid-cols-2 animate-fade-in stagger-3">
        {/* Monthly Topics */}
        <div className="rounded-2xl border border-surface-border bg-surface/50 p-6">
          <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
            <BookOpen size={18} className="text-purple-400" />
            Monthly Topics Completed
          </h3>
          {monthlyTopics.every(m => m.count === 0) ? (
            <div className="py-4 text-center text-muted text-sm rounded-lg border border-dashed border-surface-border">
              Complete topics to see monthly data
            </div>
          ) : (
            <div className="space-y-3">
              {monthlyTopics.map((m) => (
                <div key={m.month} className="flex items-center gap-3">
                  <span className="text-sm text-muted w-8">{m.month}</span>
                  <div className="flex-1 h-2 rounded-full bg-surface-hover">
                    <div
                      className="h-full rounded-full bg-purple-500 transition-all duration-500"
                      style={{ width: `${(m.count / Math.max(...monthlyTopics.map(t => t.count))) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-bold w-6 text-right">{m.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Achievements */}
        <div className="rounded-2xl border border-surface-border bg-surface/50 p-6">
          <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
            <Award size={18} className="text-yellow-400" />
            Recent Achievements
          </h3>
          {recentAchievements.length === 0 ? (
            <div className="py-4 text-center text-muted text-sm rounded-lg border border-dashed border-surface-border">
              Achievements will appear as you learn
            </div>
          ) : (
            <div className="space-y-3">
              {recentAchievements.map((a) => (
                <div key={a.title} className="flex items-center gap-3 p-2 rounded-xl hover:bg-surface-hover transition-colors">
                  <div className="h-9 w-9 rounded-lg bg-yellow-500/10 flex items-center justify-center flex-shrink-0">
                    <a.icon size={16} className="text-yellow-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{a.title}</p>
                    <p className="text-[10px] text-muted">{a.date}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Up Next */}
      <section className="mb-10 animate-fade-in stagger-3">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Target size={20} className="text-dallas-green" />
            Up Next
          </h2>
          <Link
            href="/roadmap"
            className="flex items-center gap-1 text-sm text-dallas-green hover:text-dallas-green-light transition-colors"
          >
            Open roadmap <ChevronRight size={16} />
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {upNext.map((topic, i) => (
            <Link
              key={topic.id}
              href="/roadmap"
              className="group rounded-2xl border border-surface-border bg-surface/50 p-5 hover:border-dallas-green/40 hover:bg-surface transition-all duration-300"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="h-6 w-6 rounded-full bg-dallas-green/10 flex items-center justify-center text-[10px] font-bold text-dallas-green">
                  {i + 1}
                </div>
                <span className="rounded-full bg-surface-hover px-2 py-0.5 text-[10px] font-semibold text-muted uppercase tracking-wider">
                  Upcoming
                </span>
              </div>
              <p className="text-sm font-semibold group-hover:text-dallas-green transition-colors">{topic.title}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Past Coursework — from Supabase */}
      <section className="mb-12 animate-fade-in stagger-3">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <BookOpen size={20} className="text-muted" />
            Past Coursework
          </h2>
          <Link
            href="/progress"
            className="flex items-center gap-1 text-sm text-dallas-green hover:text-dallas-green-light transition-colors"
          >
            View progress <ChevronRight size={16} />
          </Link>
        </div>

        {allPastCourses.length === 0 ? (
          <div className="rounded-2xl border border-surface-border bg-surface/50 border-dashed p-8 text-center text-muted">
            <p className="text-sm">No past coursework yet. Complete topics from your quant roadmap or enter courses from the roadmap input.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {allPastCourses.map((course: PastCourseworkItem, i: number) => (
              <div
                key={course.id ?? i}
                className={`group relative overflow-hidden rounded-2xl border border-surface-border bg-surface/50 p-5 hover:border-muted-dark hover:bg-surface transition-all duration-300 cursor-pointer stagger-${i + 1}`}
              >
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${course.color ?? "from-dallas-green/20 to-dallas-green/5"} opacity-0 group-hover:opacity-100 transition-opacity duration-500`}
                />
                <div className="relative">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="rounded-full bg-surface-hover px-3 py-1 text-[10px] font-semibold text-muted uppercase tracking-wider">
                      {course.category ?? "Quant"}
                    </span>
                    <div className="flex items-center gap-1 text-xs text-yellow-400">
                      <Star size={12} fill="currentColor" />
                      {course.rating ?? "—"}
                    </div>
                  </div>
                  <h3 className="mb-3 text-sm font-semibold group-hover:text-foreground transition-colors">
                    {course.title}
                  </h3>
                  <div className="mb-2 flex items-center justify-between text-xs text-muted">
                    <span>{course.hours ?? 0}h completed</span>
                    <span className="font-semibold text-dallas-green">
                      {course.progress ?? 0}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-surface-hover">
                    <div
                      className="h-full rounded-full bg-dallas-green animate-progress-fill"
                      style={{ width: `${Math.min(100, course.progress ?? 0)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Recommended — CTA to Roadmap */}
      <section className="mb-12 animate-fade-in stagger-3">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Sparkles size={20} className="text-dallas-green" />
            Recommended for You
          </h2>
          <span className="text-xs text-muted rounded-full bg-dallas-green/10 px-3 py-1 text-dallas-green font-medium">
            Quant · AI-Powered
          </span>
        </div>

        <div className="rounded-2xl border border-dallas-green/20 bg-gradient-to-r from-dallas-green/10 to-transparent p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold">Your quant roadmap</h3>
            <p className="text-sm text-muted mt-1">
              Generate or update your learning roadmap. Focus on derivatives pricing, risk management, stochastic calculus, or algorithmic trading — the ML pipeline + Gemini will tailor it to you.
            </p>
          </div>
          <Link
            href="/roadmap"
            className="flex items-center gap-2 rounded-xl bg-dallas-green px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-dallas-green/25 hover:bg-dallas-green-dark transition-all whitespace-nowrap"
          >
            Open Roadmap <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </div>
  );
}
