"use client";

import { BarChart3, TrendingUp, Clock, Award, Flame, Target, Loader2 } from "lucide-react";
import { useProfileData } from "@/hooks/useProfileData";

// Placeholder data when Supabase has no weekly/monthly/achievements yet
const PLACEHOLDER_WEEKLY = [
  { day: "Mon", hours: 0, target: 2 },
  { day: "Tue", hours: 0, target: 2 },
  { day: "Wed", hours: 0, target: 2 },
  { day: "Thu", hours: 0, target: 2 },
  { day: "Fri", hours: 0, target: 2 },
  { day: "Sat", hours: 0, target: 2 },
  { day: "Sun", hours: 0, target: 2 },
];

function levelGradient(level: number) {
  const hue = Math.round((level / 100) * 120);
  return `linear-gradient(90deg, hsl(0,80%,48%), hsl(${hue},80%,44%))`;
}

function overallGradient() {
  return "linear-gradient(90deg, #ef4444 0%, #eab308 50%, #46b533 100%)";
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

  const weeklyData = PLACEHOLDER_WEEKLY;
  const monthlyProgress: { month: string; topics: number }[] = [];
  const skillBreakdown = typeof skillsGained === "object" && Object.keys(skillsGained).length > 0
    ? Object.entries(skillsGained).map(([skill, level]) => ({ skill, level: Math.min(100, Number(level) || 0) }))
    : [];
  const recentAchievements: { title: string; desc: string; date: string; icon: string }[] = [];

  const maxHours = Math.max(2, ...weeklyData.map((d) => d.hours));
  const maxTopics = Math.max(1, ...monthlyProgress.map((d) => d.topics));
  const totalProgress = Math.min(100, Math.max(0, overallProgressPercentage));
  const totalHours = hoursLearned;
  const topicsDoneNum = topicsDone;

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

      {/* Overall progress — from profile_data */}
      <div className="mb-8 rounded-2xl border border-surface-border bg-surface/50 p-6 md:p-8 animate-fade-in stagger-1">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex-1">
            <h2 className="text-lg font-bold mb-1">Overall Learning Path</h2>
            <p className="text-sm text-muted mb-4">
              Based on your completed courses and topics.
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
            <p className="mt-2 text-xs text-muted">
              {totalProgress}% complete · {totalHours}h learned · {topicsDoneNum} topics done
            </p>
          </div>
          <div className="grid grid-cols-3 gap-4 md:gap-6">
            {[
              { label: "Total Hours", value: totalHours, icon: Clock, color: "text-blue-400" },
              { label: "Day Streak", value: currentStreak, icon: Flame, color: "text-orange-400" },
              { label: "Topics Done", value: topicsDoneNum, icon: Target, color: "text-dallas-green" },
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

      <div className="grid gap-6 md:grid-cols-2">
        {/* Weekly Activity — placeholder until we store it */}
        <div className="rounded-2xl border border-surface-border bg-surface/50 p-6 animate-fade-in stagger-2">
          <h3 className="mb-1 text-sm font-bold flex items-center gap-2">
            <TrendingUp size={16} className="text-dallas-green" />
            Weekly Activity
          </h3>
          <p className="mb-6 text-xs text-muted">Hours per day (tracking coming soon)</p>
          <div className="flex items-end justify-between gap-2 h-48">
            {weeklyData.map((d, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-2">
                <span className="text-[10px] font-semibold text-dallas-green">{d.hours}h</span>
                <div className="w-full relative" style={{ height: "100%" }}>
                  <div
                    className="absolute bottom-0 w-full rounded-t-lg bg-gradient-to-t from-dallas-green/60 to-dallas-green/30 transition-all duration-500"
                    style={{ height: `${(d.hours / maxHours) * 100}%` }}
                  />
                </div>
                <span className="text-[10px] text-muted">{d.day}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Monthly Topics — placeholder when empty */}
        <div className="rounded-2xl border border-surface-border bg-surface/50 p-6 animate-fade-in stagger-3">
          <h3 className="mb-1 text-sm font-bold flex items-center gap-2">
            <BarChart3 size={16} className="text-blue-400" />
            Monthly Topics Completed
          </h3>
          <p className="mb-6 text-xs text-muted">Topics by month (tracking coming soon)</p>
          {monthlyProgress.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-muted text-sm rounded-lg border border-dashed border-surface-border">
              No monthly data yet
            </div>
          ) : (
            <div className="relative h-48">
              <svg viewBox="0 0 400 180" className="w-full h-full" preserveAspectRatio="none">
                <path
                  d={`M ${monthlyProgress.map((d, i) => `${(i / (monthlyProgress.length - 1)) * 380 + 10},${180 - (d.topics / maxTopics) * 150 - 10}`).join(" L ")} L 390,180 L 10,180 Z`}
                  fill="url(#greenGradient)"
                />
                <path
                  d={`M ${monthlyProgress.map((d, i) => `${(i / (monthlyProgress.length - 1)) * 380 + 10},${180 - (d.topics / maxTopics) * 150 - 10}`).join(" L ")}`}
                  fill="none"
                  stroke="#46b533"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <defs>
                  <linearGradient id="greenGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#46b533" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#46b533" stopOpacity="0.02" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          )}
        </div>

        {/* Skill Breakdown — from profile_data.skills_gained */}
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
                    <span className="text-sm font-medium">{skill.skill}</span>
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

        {/* Recent Achievements — placeholder */}
        <div className="rounded-2xl border border-surface-border bg-surface/50 p-6 animate-fade-in stagger-5">
          <h3 className="mb-1 text-sm font-bold flex items-center gap-2">
            <Award size={16} className="text-yellow-400" />
            Recent Achievements
          </h3>
          <p className="mb-6 text-xs text-muted">Milestones (coming soon)</p>
          {recentAchievements.length === 0 ? (
            <div className="py-6 text-center text-muted text-sm border border-dashed border-surface-border rounded-lg">
              No achievements yet. Keep learning!
            </div>
          ) : (
            <div className="space-y-3">
              {recentAchievements.map((ach, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 rounded-xl border border-surface-border bg-background/30 p-4"
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
          )}
        </div>
      </div>
    </div>
  );
}
