"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Sparkles,
  ArrowRight,
  Github,
  Chrome,
} from "lucide-react";

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      {/* Gradient glow background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-dallas-green/8 blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-[300px] w-[300px] rounded-full bg-dallas-green/5 blur-[100px]" />
      </div>

      <div className="relative w-full max-w-md animate-scale-in">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-dallas-green/20 shadow-lg shadow-dallas-green/10">
            <Sparkles size={28} className="text-dallas-green" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            {isLogin ? "Welcome back" : "Create account"}
          </h1>
          <p className="mt-2 text-sm text-muted">
            {isLogin
              ? "Sign in to continue your learning journey"
              : "Start your personalized learning journey today"}
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-surface-border bg-surface/80 backdrop-blur-xl p-8 shadow-2xl shadow-black/20">
          {/* Social buttons */}
          <div className="mb-6 grid grid-cols-2 gap-3">
            <button className="flex items-center justify-center gap-2 rounded-xl border border-surface-border bg-background/50 px-4 py-3 text-sm font-medium text-muted hover:bg-surface-hover hover:text-foreground transition-all duration-200">
              <Chrome size={18} />
              Google
            </button>
            <button className="flex items-center justify-center gap-2 rounded-xl border border-surface-border bg-background/50 px-4 py-3 text-sm font-medium text-muted hover:bg-surface-hover hover:text-foreground transition-all duration-200">
              <Github size={18} />
              GitHub
            </button>
          </div>

          {/* Divider */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-surface-border" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-surface px-3 text-muted-dark">
                or continue with email
              </span>
            </div>
          </div>

          {/* Form */}
          <form
            onSubmit={(e) => e.preventDefault()}
            className="space-y-4"
          >
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-medium text-muted"
              >
                Email
              </label>
              <div className="relative">
                <Mail
                  size={18}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-dark"
                />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-xl border border-surface-border bg-background/50 py-3 pl-11 pr-4 text-sm text-foreground placeholder:text-muted-dark focus:border-dallas-green focus:outline-none focus:ring-1 focus:ring-dallas-green/50 transition-all"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium text-muted"
              >
                Password
              </label>
              <div className="relative">
                <Lock
                  size={18}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-dark"
                />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-surface-border bg-background/50 py-3 pl-11 pr-11 text-sm text-foreground placeholder:text-muted-dark focus:border-dallas-green focus:outline-none focus:ring-1 focus:ring-dallas-green/50 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-dark hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {isLogin && (
              <div className="flex justify-end">
                <button className="text-xs text-dallas-green hover:text-dallas-green-light transition-colors">
                  Forgot password?
                </button>
              </div>
            )}

            <Link href={isLogin ? "/" : "/onboarding"}>
              <button
                type="submit"
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-dallas-green px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-dallas-green/25 hover:bg-dallas-green-dark hover:shadow-dallas-green/40 transition-all duration-200 active:scale-[0.98]"
              >
                {isLogin ? "Sign In" : "Create Account"}
                <ArrowRight size={16} />
              </button>
            </Link>
          </form>
        </div>

        {/* Toggle */}
        <p className="mt-6 text-center text-sm text-muted">
          {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="font-semibold text-dallas-green hover:text-dallas-green-light transition-colors"
          >
            {isLogin ? "Sign up" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}
