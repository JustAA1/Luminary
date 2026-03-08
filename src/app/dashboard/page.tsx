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
} from "lucide-react";
import Link from "next/link";
import { useProfileData } from "@/hooks/useProfileData";
import type { PastCourseworkItem } from "@/types/database";

export default function HomePage() {
  const {
    fullName,
    coursesActive,
    hoursLearned,
    currentStreak,
    skillsGained,
    pastCoursework,
    overallProgressPercentage,
    topicsDone,
    loading,
    error,
  } = useProfileData();

  const coursesActiveCount = Array.isArray(coursesActive) ? coursesActive.length : 0;
  const skillsCount = typeof skillsGained === "object" ? Object.keys(skillsGained).length : 0;

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
          <span className="font-medium">Quant learning</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
          Welcome back, <span className="text-dallas-green">{fullName || "there"}</span>
        </h1>
        <p className="mt-2 text-muted">
          Continue your quant journey or build a new roadmap for a different area.
        </p>
        {error && (
          <p className="mt-2 text-sm text-amber-500">{error}</p>
        )}
      </div>

      {/* Stats row — from profile_data / profiles */}
      <div className="mb-10 grid grid-cols-2 gap-4 md:grid-cols-4 animate-fade-in stagger-1">
        {[
          { label: "Courses Active", value: String(coursesActiveCount), icon: BookOpen, color: "text-blue-400" },
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

      {/* Past Coursework — from profile_data.past_coursework or empty placeholder */}
      <section className="mb-12 animate-fade-in stagger-2">
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

        {pastCoursework.length === 0 ? (
          <div className="rounded-2xl border border-surface-border bg-surface/50 border-dashed p-8 text-center text-muted">
            <p className="text-sm">No coursework yet. Complete topics from your roadmap or add past quant courses in settings.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pastCoursework.map((course: PastCourseworkItem, i: number) => (
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

      {/* Recommendations — from roadmap when available; CTA to Roadmap */}
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
              Generate or update your learning roadmap. Focus on derivatives, risk, algo trading, or any quant area — the ML pipeline + Gemini will tailor it to you.
            </p>
          </div>
          <Link
            href="/roadmap"
            className="flex items-center gap-2 rounded-xl bg-dallas-green px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-dallas-green/25 hover:bg-dallas-green-dark transition-all whitespace-nowrap"
          >
            Open Roadmap <ArrowRight size={16} />
          </Link>
        </div>

        <p className="mt-3 text-xs text-muted">
          Overall progress: {overallProgressPercentage}% · Topics done: {topicsDone}
        </p>
      </section>
    </div>
  );
}
