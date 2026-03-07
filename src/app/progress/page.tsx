"use client";

import { BarChart3, TrendingUp, Clock, Award, Flame, Target } from "lucide-react";

const weeklyData = [
  { day: "Mon", hours: 2.5, target: 2 },
  { day: "Tue", hours: 3.1, target: 2 },
  { day: "Wed", hours: 1.8, target: 2 },
  { day: "Thu", hours: 4.0, target: 2 },
  { day: "Fri", hours: 2.2, target: 2 },
  { day: "Sat", hours: 5.5, target: 2 },
  { day: "Sun", hours: 3.0, target: 2 },
];

const monthlyProgress = [
  { month: "Sep", topics: 4 },
  { month: "Oct", topics: 6 },
  { month: "Nov", topics: 5 },
  { month: "Dec", topics: 8 },
  { month: "Jan", topics: 7 },
  { month: "Feb", topics: 10 },
  { month: "Mar", topics: 3 },
];

const skillBreakdown = [
  { skill: "Programming", level: 85, color: "bg-blue-500" },
  { skill: "Web Development", level: 72, color: "bg-cyan-500" },
  { skill: "Data Science", level: 45, color: "bg-purple-500" },
  { skill: "Machine Learning", level: 28, color: "bg-orange-500" },
  { skill: "Mathematics", level: 65, color: "bg-emerald-500" },
];

const recentAchievements = [
  { title: "First 100 Hours", desc: "Completed 100 total learning hours", date: "Feb 28", icon: "🏆" },
  { title: "7-Day Streak", desc: "Learned for 7 consecutive days", date: "Feb 25", icon: "🔥" },
  { title: "Quick Learner", desc: "Finished a module ahead of schedule", date: "Feb 18", icon: "⚡" },
  { title: "Night Owl", desc: "Studied past midnight 5 times", date: "Feb 10", icon: "🦉" },
];

export default function ProgressPage() {
  const maxHours = Math.max(...weeklyData.map((d) => d.hours));
  const maxTopics = Math.max(...monthlyProgress.map((d) => d.topics));
  const totalProgress = 42; // Overall % of learning path
  const totalHours = 84;
  const currentStreak = 12;

  return (
    <div className="min-h-screen px-4 py-8 md:px-8 lg:px-12">
      {/* Header */}
      <div className="mb-10 animate-fade-in">
        <div className="flex items-center gap-2 text-sm text-dallas-green mb-1">
          <BarChart3 size={14} />
          <span className="font-medium">Analytics</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
          Your Progress
        </h1>
        <p className="mt-2 text-muted">Track your learning journey and achievements.</p>
      </div>

      {/* Overall progress card */}
      <div className="mb-8 rounded-2xl border border-surface-border bg-surface/50 p-6 md:p-8 animate-fade-in stagger-1">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex-1">
            <h2 className="text-lg font-bold mb-1">Overall Learning Path</h2>
            <p className="text-sm text-muted mb-4">
              You&apos;re making great progress! Keep it up.
            </p>
            <div className="h-4 w-full rounded-full bg-surface-hover">
              <div
                className="h-full rounded-full bg-gradient-to-r from-dallas-green to-dallas-green-light animate-progress-fill relative"
                style={{ width: `${totalProgress}%` }}
              >
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-white">
                  {totalProgress}%
                </span>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted">
              {totalProgress}% complete • Estimated 6 weeks remaining
            </p>
          </div>
          <div className="grid grid-cols-3 gap-4 md:gap-6">
            {[
              { label: "Total Hours", value: totalHours, icon: Clock, color: "text-blue-400" },
              { label: "Day Streak", value: currentStreak, icon: Flame, color: "text-orange-400" },
              { label: "Topics Done", value: 18, icon: Target, color: "text-dallas-green" },
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
        {/* Weekly Activity Bar Chart */}
        <div className="rounded-2xl border border-surface-border bg-surface/50 p-6 animate-fade-in stagger-2">
          <h3 className="mb-1 text-sm font-bold flex items-center gap-2">
            <TrendingUp size={16} className="text-dallas-green" />
            Weekly Activity
          </h3>
          <p className="mb-6 text-xs text-muted">Hours spent learning this week</p>

          <div className="flex items-end justify-between gap-2 h-48">
            {weeklyData.map((d, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-2">
                <span className="text-[10px] font-semibold text-dallas-green">
                  {d.hours}h
                </span>
                <div className="w-full relative" style={{ height: "100%" }}>
                  {/* Target line */}
                  <div
                    className="absolute w-full border-t border-dashed border-muted-dark/50"
                    style={{ bottom: `${(d.target / maxHours) * 100}%` }}
                  />
                  {/* Bar */}
                  <div
                    className={`absolute bottom-0 w-full rounded-t-lg transition-all duration-500 ${
                      d.hours >= d.target
                        ? "bg-gradient-to-t from-dallas-green to-dallas-green-light"
                        : "bg-gradient-to-t from-yellow-500/80 to-yellow-400/80"
                    }`}
                    style={{
                      height: `${(d.hours / maxHours) * 100}%`,
                      animationDelay: `${i * 0.1}s`,
                    }}
                  />
                </div>
                <span className="text-[10px] text-muted">{d.day}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Monthly Topics Line Chart */}
        <div className="rounded-2xl border border-surface-border bg-surface/50 p-6 animate-fade-in stagger-3">
          <h3 className="mb-1 text-sm font-bold flex items-center gap-2">
            <BarChart3 size={16} className="text-blue-400" />
            Monthly Topics Completed
          </h3>
          <p className="mb-6 text-xs text-muted">Topics completed each month</p>

          <div className="relative h-48">
            <svg viewBox="0 0 400 180" className="w-full h-full" preserveAspectRatio="none">
              {/* Grid lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((y) => (
                <line
                  key={y}
                  x1="0"
                  y1={180 - y * 160}
                  x2="400"
                  y2={180 - y * 160}
                  stroke="currentColor"
                  className="text-surface-border"
                  strokeWidth="0.5"
                />
              ))}

              {/* Area fill */}
              <path
                d={`M ${monthlyProgress
                  .map((d, i) => {
                    const x = (i / (monthlyProgress.length - 1)) * 380 + 10;
                    const y = 180 - (d.topics / maxTopics) * 150 - 10;
                    return `${x},${y}`;
                  })
                  .join(" L ")} L 390,180 L 10,180 Z`}
                fill="url(#greenGradient)"
              />

              {/* Line */}
              <path
                d={`M ${monthlyProgress
                  .map((d, i) => {
                    const x = (i / (monthlyProgress.length - 1)) * 380 + 10;
                    const y = 180 - (d.topics / maxTopics) * 150 - 10;
                    return `${x},${y}`;
                  })
                  .join(" L ")}`}
                fill="none"
                stroke="#46b533"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Dots */}
              {monthlyProgress.map((d, i) => {
                const x = (i / (monthlyProgress.length - 1)) * 380 + 10;
                const y = 180 - (d.topics / maxTopics) * 150 - 10;
                return (
                  <circle
                    key={i}
                    cx={x}
                    cy={y}
                    r="4"
                    fill="#09090b"
                    stroke="#46b533"
                    strokeWidth="2"
                  />
                );
              })}

              <defs>
                <linearGradient id="greenGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#46b533" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#46b533" stopOpacity="0.02" />
                </linearGradient>
              </defs>
            </svg>
            {/* Labels */}
            <div className="flex justify-between mt-2 px-1">
              {monthlyProgress.map((d) => (
                <span key={d.month} className="text-[10px] text-muted">
                  {d.month}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Skill Breakdown */}
        <div className="rounded-2xl border border-surface-border bg-surface/50 p-6 animate-fade-in stagger-4">
          <h3 className="mb-1 text-sm font-bold flex items-center gap-2">
            <Award size={16} className="text-purple-400" />
            Skill Breakdown
          </h3>
          <p className="mb-6 text-xs text-muted">Your proficiency across skill areas</p>

          <div className="space-y-5">
            {skillBreakdown.map((skill) => (
              <div key={skill.skill}>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-sm font-medium">{skill.skill}</span>
                  <span className="text-xs font-semibold text-muted">{skill.level}%</span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-surface-hover">
                  <div
                    className={`h-full rounded-full ${skill.color} animate-progress-fill`}
                    style={{ width: `${skill.level}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Achievements */}
        <div className="rounded-2xl border border-surface-border bg-surface/50 p-6 animate-fade-in stagger-5">
          <h3 className="mb-1 text-sm font-bold flex items-center gap-2">
            <Award size={16} className="text-yellow-400" />
            Recent Achievements
          </h3>
          <p className="mb-6 text-xs text-muted">Your latest milestones</p>

          <div className="space-y-3">
            {recentAchievements.map((ach, i) => (
              <div
                key={i}
                className="flex items-center gap-4 rounded-xl border border-surface-border bg-background/30 p-4 hover:bg-surface-hover transition-colors"
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
