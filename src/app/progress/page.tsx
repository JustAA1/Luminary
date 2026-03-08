"use client";

import { useState, useEffect } from "react";
import { BarChart3, TrendingUp, Clock, Award, Flame, Target, Loader2, Sparkles, CalendarDays } from "lucide-react";
import { useProfileData } from "@/hooks/useProfileData";

const STORAGE_KEY = "luminary_roadmap";

interface RoadmapTopicLocal {
  id: string;
  title: string;
  status: "completed" | "in-progress" | "upcoming";
}

function levelGradient(level: number) {
  const lightness = 44 - Math.round((level / 100) * 10);
  return `linear-gradient(90deg, hsl(142,72%,${lightness + 6}%), hsl(142,72%,${lightness}%))`;
}

function overallGradient() {
  return "linear-gradient(90deg, #22c55e 0%, #16a34a 50%, #46b533 100%)";
}

function computeWeekly(totalHours: number, streak: number) {
  const dailyAvg = totalHours > 0 ? Math.round((totalHours / Math.max(7, streak)) * 10) / 10 : 0;
  const weights = [0.9, 1.0, 1.1, 0.8, 1.0, 1.3, 0.9];
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return days.map((day, i) => ({
    day,
    hours: Math.round(dailyAvg * weights[i] * 10) / 10,
    target: 2,
  }));
}

function computeMonthly(topicsDone: number) {
  const months = ["Jan", "Feb", "Mar"];
  if (topicsDone === 0) return months.map(m => ({ month: m, topics: 0 }));
  const weights = [0.25, 0.45, 0.30];
  return months.map((month, i) => ({
    month,
    topics: Math.round(topicsDone * weights[i]),
  }));
}

function computeAchievements(topicsDone: number, streak: number, totalHours: number, roadmapCount: number) {
  const achs: { title: string; desc: string; date: string; icon: string }[] = [];
  if (roadmapCount > 0) achs.push({ title: "First Roadmap Generated", desc: "Created your personalized learning path", date: "Feb 2026", icon: "🗺️" });
  if (topicsDone >= 1) achs.push({ title: "First Topic Completed", desc: "Finished your first learning topic", date: "Feb 2026", icon: "🎯" });
  if (topicsDone >= 5) achs.push({ title: "5 Topics Completed", desc: "Completed five topics on your roadmap", date: "Mar 2026", icon: "🏆" });
  if (streak >= 3) achs.push({ title: `${streak}-Day Streak`, desc: `Maintained a ${streak}-day learning streak`, date: "Mar 2026", icon: "🔥" });
  if (totalHours >= 10) achs.push({ title: "10 Hours Logged", desc: "Spent 10+ hours learning", date: "Mar 2026", icon: "⏱️" });
  if (totalHours >= 50) achs.push({ title: "50 Hours Logged", desc: "Reached 50 hours of study time", date: "Mar 2026", icon: "⭐" });
  if (achs.length === 0) achs.push({ title: "Getting Started", desc: "Begin your learning journey to earn achievements", date: "Mar 2026", icon: "🚀" });
  return achs;
}

export default function ProgressPage() {
  const {
    hoursLearned,
    currentStreak,
    overallProgressPercentage,
    topicsDone,
    skillsGained,
    loading,
  } = useProfileData();

  const [roadmapTopics, setRoadmapTopics] = useState<RoadmapTopicLocal[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setRoadmapTopics(parsed);
      }
    } catch { /* ignore */ }
  }, []);

  const completedCount = roadmapTopics.filter(t => t.status === "completed").length;
  const inProgressCount = roadmapTopics.filter(t => t.status === "in-progress").length;
  const roadmapProgress = roadmapTopics.length > 0
    ? Math.round(((completedCount + inProgressCount * 0.5) / roadmapTopics.length) * 100)
    : 0;
  const totalProgress = roadmapTopics.length > 0
    ? Math.min(100, roadmapProgress)
    : Math.min(100, Math.max(0, overallProgressPercentage));
  const totalHours = hoursLearned;

  const weeklyData = computeWeekly(totalHours, currentStreak);
  const monthlyProgress = computeMonthly(topicsDone);
  const achievements = computeAchievements(topicsDone, currentStreak, totalHours, roadmapTopics.length > 0 ? 1 : 0);
  const skillBreakdown =
    typeof skillsGained === "object" && Object.keys(skillsGained).length > 0
      ? Object.entries(skillsGained).map(([skill, level]) => ({
          skill,
          level: Math.min(100, Number(level) || 0),
        }))
      : [];

  const maxHours = Math.max(2, ...weeklyData.map((d) => d.hours));
  const maxTopics = Math.max(1, ...monthlyProgress.map((d) => d.topics));

  const skillEntries = Object.entries(skillsGained).sort((a, b) => Number(b[1]) - Number(a[1]));
  const strongestArea = skillEntries.length > 0 ? skillEntries[0][0].replace(/[-_]/g, " ") : "";
  const weakestArea = skillEntries.length > 1 ? skillEntries[skillEntries.length - 1][0].replace(/[-_]/g, " ") : "";

  const avgDaily = totalHours > 0 ? (totalHours / Math.max(7, currentStreak)).toFixed(1) : "0";
  const topicsPerWeek = topicsDone > 0 ? (topicsDone / Math.max(1, Math.ceil(currentStreak / 7))).toFixed(1) : "0";
  const completionRate = roadmapTopics.length > 0
    ? Math.round((completedCount / roadmapTopics.length) * 100)
    : totalProgress;

  const remainingTopics = roadmapTopics.length - completedCount;
  const weeksToGo = Number(topicsPerWeek) > 0 ? Math.ceil(remainingTopics / Number(topicsPerWeek)) : 0;
  const pace = Number(avgDaily) >= 2 ? "Above average" : Number(avgDaily) >= 1 ? "Steady" : Number(avgDaily) > 0 ? "Getting started" : "Not started";

  if (loading) {
    return (
      <div className="min-h-screen px-4 py-8 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-dallas-green" />
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-8 md:px-8 lg:px-12">
      <div className="mb-10 animate-fade-in">
        <div className="flex items-center gap-2 text-sm text-dallas-green mb-1">
          <BarChart3 size={14} />
          <span className="font-medium">Quant analytics</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
          Your Progress
        </h1>
        <p className="mt-2 text-muted">Track your quant learning journey.</p>
      </div>

      {/* Overall progress */}
      <div className="mb-8 rounded-2xl border border-surface-border bg-surface/50 p-6 md:p-8 animate-fade-in stagger-1">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex-1">
            <h2 className="text-lg font-bold mb-1">Overall Learning Path</h2>
            <p className="text-sm text-muted mb-4">
              {roadmapTopics.length > 0
                ? `${completedCount} of ${roadmapTopics.length} roadmap topics completed${inProgressCount > 0 ? `, ${inProgressCount} in progress` : ""}.`
                : "Based on your completed courses and topics."}
            </p>
            <div className="h-4 w-full rounded-full bg-surface-hover overflow-hidden">
              <div
                className="h-full rounded-full animate-progress-fill relative"
                style={{ width: `${totalProgress}%`, background: overallGradient() }}
              >
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-white">
                  {totalProgress}%
                </span>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted">
              <span>{totalProgress}% complete · {totalHours}h learned · {topicsDone} topics done</span>
              <span className="text-dallas-green font-medium">Pace: {pace}</span>
              {weeksToGo > 0 && (
                <span className="text-blue-400 font-medium">
                  ~{weeksToGo} weeks to go
                </span>
              )}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 md:gap-6">
            {[
              { label: "Total Hours", value: totalHours, icon: Clock, color: "text-blue-400" },
              { label: "Day Streak", value: currentStreak, icon: Flame, color: "text-orange-400" },
              { label: "Topics Done", value: topicsDone, icon: Target, color: "text-dallas-green" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <stat.icon size={20} className={`mx-auto mb-2 ${stat.color}`} />
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-[10px] text-muted">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="mb-8 grid gap-3 grid-cols-2 lg:grid-cols-4 animate-fade-in stagger-2">
        {[
          { label: "Avg. Daily Study", value: `${avgDaily}h`, color: "text-blue-400" },
          { label: "Topics / Week", value: topicsPerWeek, color: "text-dallas-green" },
          { label: "Completion Rate", value: `${completionRate}%`, color: "text-purple-400" },
          { label: "Skills Tracked", value: String(Object.keys(skillsGained).length), color: "text-amber-400" },
        ].map((m) => (
          <div key={m.label} className="rounded-2xl border border-surface-border bg-surface/50 p-4">
            <p className="text-[10px] text-muted uppercase tracking-wide mb-1">{m.label}</p>
            <p className={`text-xl font-bold ${m.color}`}>{m.value}</p>
          </div>
        ))}
        {strongestArea && (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
            <p className="text-[10px] text-muted uppercase tracking-wide mb-1">Strongest Area</p>
            <p className="text-sm font-bold text-emerald-400 capitalize">{strongestArea}</p>
          </div>
        )}
        {weakestArea && (
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
            <p className="text-[10px] text-muted uppercase tracking-wide mb-1">Needs Focus</p>
            <p className="text-sm font-bold text-amber-400 capitalize">{weakestArea}</p>
          </div>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Weekly Activity */}
        <div className="rounded-2xl border border-surface-border bg-surface/50 p-6 animate-fade-in stagger-2">
          <h3 className="mb-1 text-sm font-bold flex items-center gap-2">
            <TrendingUp size={16} className="text-dallas-green" />
            Weekly Activity
          </h3>
          <p className="mb-6 text-xs text-muted">Estimated hours per day</p>
          <div className="flex items-end justify-between gap-2 h-48">
            {weeklyData.map((d, i) => {
              const pct = maxHours > 0 ? (d.hours / maxHours) * 100 : 0;
              const hitTarget = d.hours >= d.target;
              return (
                <div key={i} className="flex flex-1 flex-col items-center gap-2">
                  <span className="text-[10px] font-semibold text-dallas-green">{d.hours}h</span>
                  <div className="w-full relative" style={{ height: "100%" }}>
                    <div
                      className="absolute bottom-0 w-full rounded-t-lg transition-all duration-500"
                      style={{
                        height: `${pct}%`,
                        background: hitTarget
                          ? "linear-gradient(to top, rgba(70,181,51,0.6), rgba(70,181,51,0.3))"
                          : "linear-gradient(to top, rgba(113,113,122,0.4), rgba(113,113,122,0.15))",
                      }}
                    />
                    <div
                      className="absolute w-full border-t border-dashed border-dallas-green/30"
                      style={{ bottom: `${(d.target / maxHours) * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-muted">{d.day}</span>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-[10px] text-muted-dark flex items-center gap-1">
            <span className="inline-block w-3 border-t border-dashed border-dallas-green/50" /> 2h daily target
          </p>
        </div>

        {/* Monthly Topics Completed */}
        <div className="rounded-2xl border border-surface-border bg-surface/50 p-6 animate-fade-in stagger-3">
          <h3 className="mb-1 text-sm font-bold flex items-center gap-2">
            <CalendarDays size={16} className="text-blue-400" />
            Monthly Topics Completed
          </h3>
          <p className="mb-6 text-xs text-muted">Topics completed each month</p>
          {monthlyProgress.every(m => m.topics === 0) ? (
            <div className="h-48 flex items-center justify-center text-muted text-sm rounded-lg border border-dashed border-surface-border">
              Complete topics to see monthly breakdown
            </div>
          ) : (
            <div className="relative h-48">
              <svg viewBox="0 0 400 180" className="w-full h-full" preserveAspectRatio="none">
                <path
                  d={`M ${monthlyProgress.map((d, i) => `${(i / Math.max(1, monthlyProgress.length - 1)) * 380 + 10},${180 - (d.topics / maxTopics) * 150 - 10}`).join(" L ")} L 390,180 L 10,180 Z`}
                  fill="url(#blueGradient)"
                />
                <path
                  d={`M ${monthlyProgress.map((d, i) => `${(i / Math.max(1, monthlyProgress.length - 1)) * 380 + 10},${180 - (d.topics / maxTopics) * 150 - 10}`).join(" L ")}`}
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {monthlyProgress.map((d, i) => (
                  <circle
                    key={i}
                    cx={(i / Math.max(1, monthlyProgress.length - 1)) * 380 + 10}
                    cy={180 - (d.topics / maxTopics) * 150 - 10}
                    r="4"
                    fill="#3b82f6"
                    stroke="#0f172a"
                    strokeWidth="2"
                  />
                ))}
                <defs>
                  <linearGradient id="blueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.02" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="flex justify-between mt-1 px-2">
                {monthlyProgress.map((d, i) => (
                  <span key={i} className="text-[10px] text-muted">{d.month} ({d.topics})</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Skill Breakdown */}
        <div className="rounded-2xl border border-surface-border bg-surface/50 p-6 animate-fade-in stagger-4">
          <h3 className="mb-1 text-sm font-bold flex items-center gap-2">
            <Award size={16} className="text-purple-400" />
            Skill Breakdown
          </h3>
          <p className="mb-6 text-xs text-muted">From your profile and progress</p>
          {skillBreakdown.length === 0 ? (
            <div className="py-6 text-center text-muted text-sm border border-dashed border-surface-border rounded-lg">
              No skills data yet. Complete topics to see breakdown.
            </div>
          ) : (
            <div className="space-y-5">
              {skillBreakdown.map((skill) => (
                <div key={skill.skill}>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-sm font-medium capitalize">{skill.skill.replace(/[-_]/g, " ")}</span>
                    <span className="text-xs font-semibold text-muted">{skill.level}%</span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-surface-hover overflow-hidden">
                    <div
                      className="h-full rounded-full animate-progress-fill"
                      style={{ width: `${skill.level}%`, background: levelGradient(skill.level) }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Achievements */}
        <div className="rounded-2xl border border-surface-border bg-surface/50 p-6 animate-fade-in stagger-5">
          <h3 className="mb-1 text-sm font-bold flex items-center gap-2">
            <Sparkles size={16} className="text-yellow-400" />
            Recent Achievements
          </h3>
          <p className="mb-6 text-xs text-muted">Milestones from your learning journey</p>
          <div className="space-y-3">
            {achievements.map((ach, i) => (
              <div
                key={i}
                className="flex items-center gap-4 rounded-xl border border-surface-border bg-background/30 p-4 hover:border-yellow-500/30 hover:bg-surface-hover/30 transition-colors"
              >
                <span className="text-2xl">{ach.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{ach.title}</p>
                  <p className="text-xs text-muted-dark truncate">{ach.desc}</p>
                </div>
                <span className="text-[10px] text-muted-dark whitespace-nowrap">{ach.date}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
