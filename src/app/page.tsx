"use client";

import {
  BookOpen,
  Clock,
  Sparkles,
  TrendingUp,
  ChevronRight,
  Play,
  Star,
  ArrowRight,
  Zap,
} from "lucide-react";

const pastCourses = [
  {
    id: 1,
    title: "Introduction to Python",
    category: "Programming",
    progress: 100,
    hours: 24,
    rating: 4.8,
    color: "from-blue-500/20 to-blue-600/5",
  },
  {
    id: 2,
    title: "Linear Algebra Fundamentals",
    category: "Mathematics",
    progress: 85,
    hours: 18,
    rating: 4.5,
    color: "from-purple-500/20 to-purple-600/5",
  },
  {
    id: 3,
    title: "HTML & CSS Mastery",
    category: "Web Development",
    progress: 100,
    hours: 16,
    rating: 4.9,
    color: "from-orange-500/20 to-orange-600/5",
  },
  {
    id: 4,
    title: "Statistics for Data Science",
    category: "Data Science",
    progress: 62,
    hours: 12,
    rating: 4.3,
    color: "from-emerald-500/20 to-emerald-600/5",
  },
  {
    id: 5,
    title: "JavaScript Essentials",
    category: "Programming",
    progress: 45,
    hours: 8,
    rating: 4.7,
    color: "from-yellow-500/20 to-yellow-600/5",
  },
  {
    id: 6,
    title: "React Fundamentals",
    category: "Web Development",
    progress: 30,
    hours: 6,
    rating: 4.6,
    color: "from-cyan-500/20 to-cyan-600/5",
  },
];

const recommendations = [
  {
    id: 1,
    title: "Deep Learning with PyTorch",
    reason: "Based on your Python mastery",
    difficulty: "Intermediate",
    duration: "8 weeks",
    match: 95,
    icon: "🧠",
  },
  {
    id: 2,
    title: "Advanced React Patterns",
    reason: "Continues your React journey",
    difficulty: "Advanced",
    duration: "4 weeks",
    match: 92,
    icon: "⚛️",
  },
  {
    id: 3,
    title: "Natural Language Processing",
    reason: "Matches your AI interest",
    difficulty: "Intermediate",
    duration: "6 weeks",
    match: 88,
    icon: "📝",
  },
  {
    id: 4,
    title: "Cloud Architecture on AWS",
    reason: "Complements your DevOps skills",
    difficulty: "Intermediate",
    duration: "5 weeks",
    match: 85,
    icon: "☁️",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen px-4 py-8 md:px-8 lg:px-12">
      {/* Header */}
      <div className="mb-10 animate-fade-in">
        <div className="flex items-center gap-2 text-sm text-dallas-green mb-1">
          <Sparkles size={14} />
          <span className="font-medium">Good afternoon</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
          Welcome back, <span className="text-dallas-green">Alex</span>
        </h1>
        <p className="mt-2 text-muted">
          Continue where you left off or explore new recommendations.
        </p>
      </div>

      {/* Stats row */}
      <div className="mb-10 grid grid-cols-2 gap-4 md:grid-cols-4 animate-fade-in stagger-1">
        {[
          { label: "Courses Active", value: "4", icon: BookOpen, color: "text-blue-400" },
          { label: "Hours Learned", value: "84", icon: Clock, color: "text-purple-400" },
          { label: "Current Streak", value: "12d", icon: Zap, color: "text-yellow-400" },
          { label: "Skills Gained", value: "18", icon: TrendingUp, color: "text-dallas-green" },
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

      {/* Past Coursework */}
      <section className="mb-12 animate-fade-in stagger-2">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <BookOpen size={20} className="text-muted" />
            Past Coursework
          </h2>
          <button className="flex items-center gap-1 text-sm text-dallas-green hover:text-dallas-green-light transition-colors">
            View all <ChevronRight size={16} />
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pastCourses.map((course, i) => (
            <div
              key={course.id}
              className={`group relative overflow-hidden rounded-2xl border border-surface-border bg-surface/50 p-5 hover:border-muted-dark hover:bg-surface transition-all duration-300 cursor-pointer stagger-${i + 1}`}
            >
              <div
                className={`absolute inset-0 bg-gradient-to-br ${course.color} opacity-0 group-hover:opacity-100 transition-opacity duration-500`}
              />
              <div className="relative">
                <div className="mb-3 flex items-center justify-between">
                  <span className="rounded-full bg-surface-hover px-3 py-1 text-[10px] font-semibold text-muted uppercase tracking-wider">
                    {course.category}
                  </span>
                  <div className="flex items-center gap-1 text-xs text-yellow-400">
                    <Star size={12} fill="currentColor" />
                    {course.rating}
                  </div>
                </div>
                <h3 className="mb-3 text-sm font-semibold group-hover:text-foreground transition-colors">
                  {course.title}
                </h3>
                <div className="mb-2 flex items-center justify-between text-xs text-muted">
                  <span>{course.hours}h completed</span>
                  <span className="font-semibold text-dallas-green">
                    {course.progress}%
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-surface-hover">
                  <div
                    className="h-full rounded-full bg-dallas-green animate-progress-fill"
                    style={{ width: `${course.progress}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ML Recommendations */}
      <section className="mb-12 animate-fade-in stagger-3">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Sparkles size={20} className="text-dallas-green" />
            Recommended for You
          </h2>
          <span className="text-xs text-muted rounded-full bg-dallas-green/10 px-3 py-1 text-dallas-green font-medium">
            AI-Powered
          </span>
        </div>

        <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 snap-x snap-mandatory">
          {recommendations.map((rec) => (
            <div
              key={rec.id}
              className="group min-w-[300px] snap-start rounded-2xl border border-surface-border bg-surface/50 p-6 hover:border-dallas-green/30 hover:bg-surface transition-all duration-300 flex-shrink-0 cursor-pointer"
            >
              <div className="mb-4 flex items-center justify-between">
                <span className="text-3xl">{rec.icon}</span>
                <div className="flex items-center gap-1 rounded-full bg-dallas-green/15 px-2.5 py-1 text-xs font-bold text-dallas-green">
                  {rec.match}% match
                </div>
              </div>
              <h3 className="mb-2 text-base font-semibold group-hover:text-dallas-green transition-colors">
                {rec.title}
              </h3>
              <p className="mb-4 text-xs text-muted">{rec.reason}</p>
              <div className="flex items-center justify-between">
                <div className="flex gap-3 text-xs text-muted-dark">
                  <span>{rec.difficulty}</span>
                  <span>•</span>
                  <span>{rec.duration}</span>
                </div>
                <Play
                  size={16}
                  className="text-muted group-hover:text-dallas-green transition-colors"
                />
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-6 rounded-2xl border border-dallas-green/20 bg-gradient-to-r from-dallas-green/10 to-transparent p-6 flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Ready to continue your journey?</h3>
            <p className="text-sm text-muted mt-1">Pick up where you left off with personalized AI guidance.</p>
          </div>
          <button className="flex items-center gap-2 rounded-xl bg-dallas-green px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-dallas-green/25 hover:bg-dallas-green-dark transition-all whitespace-nowrap">
            Continue Learning <ArrowRight size={16} />
          </button>
        </div>
      </section>
    </div>
  );
}
