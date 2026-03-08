"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  ArrowRight,
  Brain,
  Map,
  BarChart3,
  CalendarDays,
  ChevronRight,
  Zap,
  Star,
  Users,
  Trophy,
} from "lucide-react";

const features = [
  {
    icon: Brain,
    title: "AI-Powered Roadmaps",
    desc: "Get a personalized learning path built around your skills, goals, and schedule — not a one-size-fits-all curriculum.",
    gradient: "from-violet-500/20 to-violet-600/5",
    iconColor: "text-violet-400",
  },
  {
    icon: BarChart3,
    title: "Real-time Progress",
    desc: "Track every milestone. Visual dashboards show exactly how far you've come and what comes next.",
    gradient: "from-blue-500/20 to-blue-600/5",
    iconColor: "text-blue-400",
  },
  {
    icon: Map,
    title: "Interactive Roadmap",
    desc: "Explore your skill tree visually. Mark topics complete, dive into subtopics, and see the bigger picture.",
    gradient: "from-dallas-green/20 to-dallas-green/5",
    iconColor: "text-dallas-green",
  },
  {
    icon: CalendarDays,
    title: "Smart Scheduling",
    desc: "Sync study sessions to your calendar. Luminary plans your week so you stay consistent without burning out.",
    gradient: "from-orange-500/20 to-orange-600/5",
    iconColor: "text-orange-400",
  },
];

const stats = [
  { value: "50K+", label: "Learners", icon: Users },
  { value: "4.9", label: "Avg. Rating", icon: Star },
  { value: "200+", label: "Skill Tracks", icon: Trophy },
  { value: "3×", label: "Faster Progress", icon: Zap },
];

const testimonials = [
  {
    quote: "Luminary completely changed how I study. I went from scattered YouTube tutorials to a laser-focused AI roadmap. Landed my first dev job in 4 months.",
    name: "Priya M.",
    role: "Frontend Engineer",
    initials: "PM",
    color: "bg-violet-500",
  },
  {
    quote: "The roadmap feature alone is worth it. It adapted to my pace and suggested resources I actually understood. Never felt lost.",
    name: "James L.",
    role: "Data Analyst",
    initials: "JL",
    color: "bg-blue-500",
  },
  {
    quote: "I've tried Coursera, Udemy, everything. Luminary is the first platform that feels like it actually knows me. Wild how good the AI recommendations are.",
    name: "Sofia R.",
    role: "ML Researcher",
    initials: "SR",
    color: "bg-dallas-green",
  },
];

function OrbCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let t = 0;

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();
    window.addEventListener("resize", resize);

    const particles: { x: number; y: number; vx: number; vy: number; r: number; alpha: number }[] = [];
    for (let i = 0; i < 60; i++) {
      particles.push({
        x: Math.random() * canvas.offsetWidth,
        y: Math.random() * canvas.offsetHeight,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        r: Math.random() * 1.5 + 0.5,
        alpha: Math.random() * 0.4 + 0.1,
      });
    }

    const draw = () => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      ctx.clearRect(0, 0, w, h);
      t += 0.008;

      // Glowing orbs
      const orbs = [
        { x: w * 0.5 + Math.sin(t * 0.7) * 60, y: h * 0.4 + Math.cos(t * 0.5) * 40, r: 180, color: "rgba(70,181,51," },
        { x: w * 0.3 + Math.cos(t * 0.4) * 50, y: h * 0.6 + Math.sin(t * 0.6) * 35, r: 130, color: "rgba(139,92,246," },
        { x: w * 0.7 + Math.sin(t * 0.55) * 45, y: h * 0.35 + Math.cos(t * 0.7) * 30, r: 110, color: "rgba(59,130,246," },
      ];

      orbs.forEach(({ x, y, r, color }) => {
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, color + "0.12)");
        g.addColorStop(1, color + "0)");
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();
      });

      // Particles
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = w;
        if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h;
        if (p.y > h) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(70,181,51,${p.alpha})`;
        ctx.fill();
      });

      // Connecting lines between nearby particles
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 100) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(70,181,51,${0.07 * (1 - dist / 100)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      animId = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />;
}

function TypewriterText({ texts }: { texts: string[] }) {
  const [idx, setIdx] = useState(0);
  const [displayed, setDisplayed] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const current = texts[idx];
    let timeout: ReturnType<typeof setTimeout>;

    if (!deleting && displayed.length < current.length) {
      timeout = setTimeout(() => setDisplayed(current.slice(0, displayed.length + 1)), 55);
    } else if (!deleting && displayed.length === current.length) {
      timeout = setTimeout(() => setDeleting(true), 2000);
    } else if (deleting && displayed.length > 0) {
      timeout = setTimeout(() => setDisplayed(displayed.slice(0, -1)), 28);
    } else if (deleting && displayed.length === 0) {
      timeout = setTimeout(() => {
        setDeleting(false);
        setIdx((i) => (i + 1) % texts.length);
      }, 50);
    }

    return () => clearTimeout(timeout);
  }, [displayed, deleting, idx, texts]);

  return (
    <span className="text-dallas-green">
      {displayed}
      <span className="inline-block w-0.5 h-8 md:h-10 ml-1 bg-dallas-green align-middle animate-pulse" />
    </span>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen w-full overflow-x-hidden">

      {/* ── Hero ── */}
      <section className="relative flex min-h-screen flex-col items-center justify-center px-4 text-center overflow-hidden">
        <OrbCanvas />

        {/* Nav bar */}
        <nav className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 py-5 z-20">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-dallas-green/20">
              <Sparkles size={18} className="text-dallas-green" />
            </div>
            <span className="text-lg font-bold tracking-tight">Luminary</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-xl px-4 py-2 text-sm font-medium text-muted hover:text-foreground transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/login"
              className="btn-neon rounded-xl px-5 py-2 text-sm"
            >
              Get Started
            </Link>
          </div>
        </nav>

        {/* Hero content */}
        <div className="relative z-10 max-w-4xl mx-auto animate-fade-in">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-dallas-green/25 bg-dallas-green/10 px-4 py-1.5 text-xs font-medium text-dallas-green">
            <Sparkles size={12} />
            AI-Powered Learning Platform
          </div>

          <h1 className="text-5xl font-extrabold tracking-tight md:text-7xl leading-tight">
            Learn smarter.<br />
            <TypewriterText texts={["Master Python.", "Build React apps.", "Ace Data Science.", "Go Full Stack.", "Understand ML."]} />
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted md:text-xl leading-relaxed">
            Luminary builds a personalized AI roadmap around your goals, tracks every milestone, and adapts as you grow — so you never waste another hour on the wrong thing.
          </p>

          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/login"
              className="btn-neon flex items-center gap-2 rounded-2xl px-8 py-4 text-base font-semibold"
            >
              Start Learning Free
              <ArrowRight size={18} />
            </Link>
            <Link
              href="/login"
              className="flex items-center gap-2 rounded-2xl border border-surface-border bg-surface/50 px-8 py-4 text-base font-medium text-muted hover:bg-surface hover:text-foreground transition-all"
            >
              Sign in
              <ChevronRight size={16} />
            </Link>
          </div>

          <p className="mt-5 text-xs text-muted-dark">
            No credit card required · Free forever plan available
          </p>
        </div>

        {/* Scroll hint */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-1 text-muted-dark animate-bounce">
          <div className="h-6 w-px bg-gradient-to-b from-transparent to-muted-dark/50" />
          <div className="h-4 w-4 rounded-full border border-muted-dark/40" />
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="border-y border-surface-border bg-surface/30 py-14">
        <div className="mx-auto grid max-w-4xl grid-cols-2 gap-6 px-6 md:grid-cols-4">
          {stats.map((s, i) => (
            <div
              key={s.label}
              className={`flex flex-col items-center gap-2 animate-fade-in stagger-${i + 1}`}
            >
              <s.icon size={20} className="text-dallas-green mb-1" />
              <p className="text-3xl font-extrabold">{s.value}</p>
              <p className="text-sm text-muted">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="mb-14 text-center">
          <p className="text-sm font-medium text-dallas-green mb-2">Everything you need</p>
          <h2 className="text-4xl font-bold tracking-tight md:text-5xl">Built to make you unstoppable</h2>
          <p className="mt-4 text-muted max-w-xl mx-auto">
            From AI roadmaps to smart scheduling, every feature is designed around one goal: your growth.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f, i) => (
            <div
              key={f.title}
              className={`group relative overflow-hidden rounded-2xl border border-surface-border bg-surface/50 p-6 hover:border-muted-dark hover:bg-surface transition-all duration-300 cursor-default animate-fade-in stagger-${i + 1}`}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${f.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
              <div className="relative">
                <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-surface-hover ${f.iconColor} group-hover:scale-110 transition-transform duration-300`}>
                  <f.icon size={22} />
                </div>
                <h3 className="mb-2 font-semibold">{f.title}</h3>
                <p className="text-sm text-muted leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="border-t border-surface-border bg-surface/20 py-24 px-6">
        <div className="mx-auto max-w-6xl">
          <div className="mb-14 text-center">
            <p className="text-sm font-medium text-dallas-green mb-2">Real learners, real results</p>
            <h2 className="text-4xl font-bold tracking-tight md:text-5xl">People who made it happen</h2>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {testimonials.map((t, i) => (
              <div
                key={t.name}
                className={`glass-card p-6 animate-fade-in stagger-${i + 1}`}
              >
                <div className="mb-4 flex gap-1">
                  {[...Array(5)].map((_, s) => (
                    <Star key={s} size={13} className="text-yellow-400 fill-yellow-400" />
                  ))}
                </div>
                <p className="text-sm text-muted leading-relaxed mb-5">&quot;{t.quote}&quot;</p>
                <div className="flex items-center gap-3">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-full ${t.color} text-xs font-bold text-white`}>
                    {t.initials}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{t.name}</p>
                    <p className="text-xs text-muted">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative overflow-hidden py-28 px-6">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-dallas-green/8 blur-[120px]" />
        </div>
        <div className="relative mx-auto max-w-2xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-dallas-green/25 bg-dallas-green/10 px-4 py-1.5 text-xs font-medium text-dallas-green">
            <Zap size={12} />
            Start free today
          </div>
          <h2 className="text-4xl font-bold tracking-tight md:text-5xl mb-6">
            Your next breakthrough<br />starts here.
          </h2>
          <p className="text-muted mb-10 text-lg">
            Join 50,000+ learners who stopped guessing and started growing with Luminary.
          </p>
          <Link
            href="/login"
            className="btn-neon inline-flex items-center gap-2 rounded-2xl px-10 py-4 text-base font-semibold"
          >
            Create your free account
            <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-surface-border py-8 px-6 text-center text-xs text-muted-dark">
        <div className="flex items-center justify-center gap-2 mb-3">
          <Sparkles size={14} className="text-dallas-green" />
          <span className="font-semibold text-sm text-foreground">Luminary</span>
        </div>
        © {new Date().getFullYear()} Luminary. All rights reserved.
      </footer>
    </div>
  );
}
