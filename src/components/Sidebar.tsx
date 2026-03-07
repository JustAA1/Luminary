"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  BarChart3,
  Map,
  CalendarDays,
  Menu,
  X,
  Sparkles,
  LogOut,
  Loader2,
} from "lucide-react";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/progress", label: "Progress", icon: BarChart3 },
  { href: "/roadmap", label: "Roadmap", icon: Map },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const supabase = createClient();

  // Fetch user on mount
  useEffect(() => {
    if (!supabase) return;

    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, [supabase]);

  const handleSignOut = async () => {
    if (!supabase) {
      router.push("/login");
      return;
    }
    setSigningOut(true);
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  // Hide sidebar on login/onboarding routes
  const hiddenRoutes = ["/login", "/onboarding"];
  if (hiddenRoutes.some((r) => pathname.startsWith(r))) return null;

  // User info
  const userName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User";
  const userInitial = userName.charAt(0).toUpperCase();
  const avatarUrl = user?.user_metadata?.avatar_url;

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-50 rounded-lg bg-surface p-2 text-muted md:hidden hover:bg-surface-hover transition-colors"
        aria-label="Open menu"
      >
        <Menu size={22} />
      </button>

      {/* Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 z-50 flex h-screen w-64 flex-col border-r border-surface-border bg-surface
          transition-transform duration-300 ease-in-out
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
          md:translate-x-0 md:static md:z-auto
        `}
      >
        {/* Close button (mobile) */}
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-4 right-4 text-muted md:hidden hover:text-foreground transition-colors"
          aria-label="Close menu"
        >
          <X size={20} />
        </button>

        {/* Brand */}
        <div className="flex items-center gap-3 px-6 pt-8 pb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-dallas-green/20">
            <Sparkles size={22} className="text-dallas-green" />
          </div>
          <span className="text-xl font-bold tracking-tight">Luminary</span>
        </div>

        {/* Profile */}
        <div className="mx-4 mt-6 flex items-center gap-3 rounded-xl bg-background/50 px-4 py-3">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={userName}
              className="h-9 w-9 rounded-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-dallas-green text-sm font-bold text-white">
              {userInitial}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{userName}</p>
            <p className="truncate text-xs text-muted">learner</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="mt-8 flex-1 space-y-1 px-3">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`
                  group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200
                  ${isActive
                    ? "bg-dallas-green/15 text-dallas-green shadow-sm"
                    : "text-muted hover:bg-surface-hover hover:text-foreground"
                  }
                `}
              >
                <item.icon
                  size={20}
                  className={`transition-transform duration-200 group-hover:scale-110 ${isActive ? "text-dallas-green" : ""
                    }`}
                />
                {item.label}
                {isActive && (
                  <div className="ml-auto h-1.5 w-1.5 rounded-full bg-dallas-green animate-pulse-glow" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-surface-border p-4">
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-muted hover:bg-surface-hover hover:text-foreground transition-colors disabled:opacity-60"
          >
            {signingOut ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <LogOut size={18} />
            )}
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}
