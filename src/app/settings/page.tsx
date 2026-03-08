"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Upload, BookOpen, CheckCircle2, X, GraduationCap, Search,
  Brain, Heart, Clock, Loader2, Save,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// ─── Constants (mirror onboarding) ───────────────────────────────────────────

const majors = [
  "Quantitative Finance",
  "Financial Engineering",
  "Mathematics",
  "Statistics",
  "Computer Science",
  "Physics",
  "Economics",
  "Applied Mathematics",
  "Data Science",
  "Actuarial Science",
  "Operations Research",
  "Computational Finance",
  "Risk Management",
  "Financial Mathematics",
  "Electrical Engineering",
];

const skillLevels = [
  { id: "programming", label: "Programming (Python/C++)" },
  { id: "math", label: "Mathematics & Statistics" },
  { id: "finance", label: "Finance & Markets" },
  { id: "stochastic-calc", label: "Stochastic Calculus" },
  { id: "ml", label: "Machine Learning" },
  { id: "data-science", label: "Data Science" },
];

const interestOptions = [
  "Derivatives Pricing",
  "Risk Management",
  "Algorithmic Trading",
  "Portfolio Optimization",
  "Fixed Income",
  "Volatility Modeling",
  "Statistical Arbitrage",
  "Monte Carlo Methods",
  "Time Series Analysis",
  "Credit Risk",
  "Market Microstructure",
  "Quantitative Research",
  "Options Theory",
  "Factor Models",
  "Machine Learning in Finance",
  "Stochastic Processes",
];

// ─── Page ────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  // profile state
  const [selectedMajor, setSelectedMajor] = useState("Quantitative Finance");
  const [skills, setSkills] = useState<Record<string, number>>({});
  const [interests, setInterests] = useState<string[]>([]);
  const [hoursPerWeek, setHoursPerWeek] = useState(10);
  const [resumeFile, setResumeFile] = useState<string | null>(null);

  // saved state for dirty checking
  const [saved, setSaved] = useState({
    major: "Quantitative Finance",
    skills: {} as Record<string, number>,
    interests: [] as string[],
    hoursPerWeek: 10,
    resume: null as string | null,
  });

  // UI state
  const [search, setSearch] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fileRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isDirty =
    selectedMajor !== saved.major ||
    resumeFile !== saved.resume ||
    hoursPerWeek !== saved.hoursPerWeek ||
    JSON.stringify(skills) !== JSON.stringify(saved.skills) ||
    JSON.stringify([...interests].sort()) !== JSON.stringify([...saved.interests].sort());

  const filtered = majors.filter((m) =>
    m.toLowerCase().includes(search.toLowerCase())
  );

  // ─── Load from Supabase ────────────────────────────────────────────────────

  const loadProfile = useCallback(async () => {
    const supabase = createClient();
    if (!supabase) { setLoading(false); return; }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      // Try loading by id first (direct RLS match), fallback to email
      let data = null;

      const { data: byId, error: errId } = await supabase
        .from("profiles")
        .select("skills, hobbies, hours_per_week")
        .eq("id", user.id)
        .single();

      if (!errId && byId) {
        data = byId;
      } else {
        const email = user.email;
        if (email) {
          const { data: byEmail, error: errEmail } = await supabase
            .from("profiles")
            .select("skills, hobbies, hours_per_week")
            .eq("email", email)
            .single();
          if (errEmail) {
            console.error("Load profile error:", errEmail.message);
          }
          data = byEmail;
        }
      }

      if (data) {
        const loadedSkills = (typeof data.skills === "object" && data.skills !== null ? data.skills : {}) as Record<string, number>;
        const loadedHobbies = (Array.isArray(data.hobbies) ? data.hobbies : []) as string[];
        const loadedHours = Number(data.hours_per_week) || 10;

        setSkills(loadedSkills);
        setInterests(loadedHobbies);
        setHoursPerWeek(loadedHours);
        setSaved((prev) => ({
          ...prev,
          skills: loadedSkills,
          interests: loadedHobbies,
          hoursPerWeek: loadedHours,
        }));
      }
      // Try to get field_of_study from localStorage (stored on save)
      try {
        const ls = localStorage.getItem("luminary_onboarding");
        if (ls) {
          const parsed = JSON.parse(ls);
          if (parsed.field_of_study) {
            setSelectedMajor(parsed.field_of_study);
            setSaved((prev) => ({ ...prev, major: parsed.field_of_study }));
          }
          if (parsed.resume_file) {
            setResumeFile(parsed.resume_file);
            setSaved((prev) => ({ ...prev, resume: parsed.resume_file }));
          }
        }
      } catch {}
    } catch (e) {
      console.warn("Settings load failed:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ─── Save ──────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!isDirty) return;
    setSaveState("saving");
    setSaveError(null);

    try {
      const supabase = createClient();
      if (!supabase) {
        setSaveError("Supabase not configured.");
        setSaveState("error");
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        setSaveError("Not signed in.");
        setSaveState("error");
        return;
      }

      const email = user.email;

      // Update profiles table — try by id first, fallback to email
      const profilePayload = {
        skills: skills,
        hobbies: interests,
        hours_per_week: hoursPerWeek,
        updated_at: new Date().toISOString(),
      };

      const { data: updatedById, error: errById } = await supabase
        .from("profiles")
        .update(profilePayload)
        .eq("id", user.id)
        .select();

      if (errById) {
        console.error("Profile update by id failed:", errById.message);
      }

      // Fallback: try by email if id-based update hit 0 rows
      if (!updatedById || updatedById.length === 0) {
        const { data: updatedByEmail, error: errByEmail } = await supabase
          .from("profiles")
          .update(profilePayload)
          .eq("email", email)
          .select();

        if (errByEmail) {
          console.error("Profile update by email failed:", errByEmail.message);
          setSaveError(`Profile save failed: ${errByEmail.message}`);
          setSaveState("error");
          return;
        }
        if (!updatedByEmail || updatedByEmail.length === 0) {
          setSaveError("No profile row found. Please re-login or contact support.");
          setSaveState("error");
          return;
        }
      }

      // Also update skills_gained in profile_data by user_id
      if (user.id) {
        const skillsGained: Record<string, number> = {};
        for (const [k, v] of Object.entries(skills)) {
          skillsGained[k] = typeof v === "number" ? Math.min(100, v * 25) : 0;
        }
        await supabase
          .from("profile_data")
          .update({
            skills_gained: skillsGained,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", user.id);
      }
    } catch (e) {
      console.error("Settings save to Supabase failed:", e);
      setSaveError(e instanceof Error ? e.message : "Save failed");
      setSaveState("error");
      return;
    }

    // Also save to localStorage
    try {
      const existing = localStorage.getItem("luminary_onboarding");
      const parsed = existing ? JSON.parse(existing) : {};
      parsed.field_of_study = selectedMajor;
      parsed.skills = skills;
      parsed.interests = interests;
      parsed.hours_per_week = hoursPerWeek;
      if (resumeFile) parsed.resume_file = resumeFile;
      localStorage.setItem("luminary_onboarding", JSON.stringify(parsed));
    } catch {}

    setSaved({
      major: selectedMajor,
      skills: { ...skills },
      interests: [...interests],
      hoursPerWeek,
      resume: resumeFile,
    });
    setSaveState("saved");
    setTimeout(() => setSaveState("idle"), 2500);
  };

  const toggleInterest = (interest: string) => {
    setInterests((prev) =>
      prev.includes(interest)
        ? prev.filter((i) => i !== interest)
        : [...prev, interest]
    );
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith(".pdf") || file.name.endsWith(".docx"))) {
      setResumeFile(file.name);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

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
      <div className="mb-8 animate-fade-in">
        <div className="flex items-center gap-2 text-sm text-dallas-green mb-1">
          <BookOpen size={14} />
          <span className="font-medium">Preferences</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Settings</h1>
        <p className="mt-2 text-muted">Update your profile, skills, interests, and preferences. These are the same options from onboarding.</p>
      </div>

      <div className="max-w-2xl space-y-8 animate-fade-in stagger-1">

        {/* ── Skills ─────────────────────────────────────────────────── */}
        <div className="glass-card p-6 space-y-5">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Brain size={17} className="text-dallas-green" />
            Skill Levels
          </h2>
          <p className="text-xs text-muted">Adjust your self-assessed skill levels. These influence your roadmap recommendations.</p>

          <div className="space-y-5">
            {skillLevels.map((skill) => (
              <div key={skill.id}>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-medium">{skill.label}</label>
                  <span className="text-xs text-dallas-green font-semibold">
                    {["Beginner", "Elementary", "Intermediate", "Advanced", "Expert"][(skills[skill.id] || 0)]}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="4"
                  value={skills[skill.id] || 0}
                  onChange={(e) =>
                    setSkills((prev) => ({
                      ...prev,
                      [skill.id]: parseInt(e.target.value),
                    }))
                  }
                  className="w-full appearance-none h-2 rounded-full bg-surface-hover cursor-pointer
                    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-dallas-green [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-dallas-green/30 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-dallas-green-light [&::-webkit-slider-thumb]:transition-all [&::-webkit-slider-thumb]:hover:scale-110
                    [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-dallas-green [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-dallas-green-light"
                />
                <div className="mt-1 flex justify-between">
                  {["Beg", "Elem", "Inter", "Adv", "Expert"].map((label, i) => (
                    <span
                      key={i}
                      className={`text-[10px] ${(skills[skill.id] || 0) === i ? "text-dallas-green" : "text-muted-dark"}`}
                    >
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Interests ──────────────────────────────────────────────── */}
        <div className="glass-card p-6 space-y-4">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Heart size={17} className="text-dallas-green" />
            Interests
          </h2>
          <p className="text-xs text-muted">Select quant topics that interest you. These personalize your learning path.</p>

          <div className="flex flex-wrap gap-3">
            {interestOptions.map((interest) => {
              const selected = interests.includes(interest);
              return (
                <button
                  key={interest}
                  onClick={() => toggleInterest(interest)}
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200 active:scale-95 ${
                    selected
                      ? "border-dallas-green bg-dallas-green/15 text-dallas-green shadow-sm shadow-dallas-green/10"
                      : "border-surface-border text-muted hover:border-muted-dark hover:text-foreground"
                  }`}
                >
                  {selected && <CheckCircle2 size={14} className="mr-1.5 inline-block" />}
                  {interest}
                </button>
              );
            })}
          </div>

          {interests.length > 0 && (
            <p className="text-xs text-muted">
              <span className="font-semibold text-dallas-green">{interests.length}</span> topics selected
            </p>
          )}
        </div>

        {/* ── Hours per Week ──────────────────────────────────────────── */}
        <div className="glass-card p-6 space-y-4">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Clock size={17} className="text-dallas-green" />
            Weekly Time Commitment
          </h2>
          <p className="text-xs text-muted">How many hours per week can you dedicate to learning?</p>

          <div className="flex flex-col items-center">
            <div className="relative mb-6 flex h-32 w-32 items-center justify-center">
              <svg className="absolute inset-0" viewBox="0 0 160 160">
                <circle cx="80" cy="80" r="64" fill="none" stroke="currentColor" className="text-surface-hover" strokeWidth="8" />
                <circle cx="80" cy="80" r="64" fill="none" stroke="currentColor" className="text-dallas-green" strokeWidth="8" strokeLinecap="round"
                  strokeDasharray={`${(hoursPerWeek / 40) * 402} 402`}
                  transform="rotate(-90 80 80)"
                  style={{ transition: "stroke-dasharray 0.3s ease" }}
                />
              </svg>
              <div className="text-center">
                <span className="text-3xl font-bold text-dallas-green">{hoursPerWeek}</span>
                <p className="text-xs text-muted">hrs/week</p>
              </div>
            </div>

            <input
              type="range"
              min="1"
              max="40"
              value={hoursPerWeek}
              onChange={(e) => setHoursPerWeek(parseInt(e.target.value))}
              className="w-full max-w-xs appearance-none h-2 rounded-full bg-surface-hover cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-dallas-green [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-dallas-green/30 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-dallas-green-light
                [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-dallas-green [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-dallas-green-light"
            />
            <div className="mt-2 flex w-full max-w-xs justify-between">
              <span className="text-xs text-muted-dark">1 hr</span>
              <span className="text-xs text-muted-dark">20 hrs</span>
              <span className="text-xs text-muted-dark">40 hrs</span>
            </div>

            <div className="mt-6 grid w-full max-w-xs grid-cols-3 gap-3">
              {[
                { hours: 5, label: "Casual", desc: "~1 hr/day" },
                { hours: 15, label: "Committed", desc: "~2 hrs/day" },
                { hours: 30, label: "Intensive", desc: "~4 hrs/day" },
              ].map((preset) => (
                <button
                  key={preset.hours}
                  onClick={() => setHoursPerWeek(preset.hours)}
                  className={`rounded-xl border p-3 text-center transition-all duration-200 ${
                    hoursPerWeek === preset.hours
                      ? "border-dallas-green bg-dallas-green/10 text-dallas-green"
                      : "border-surface-border text-muted hover:border-muted-dark"
                  }`}
                >
                  <p className="text-sm font-semibold">{preset.label}</p>
                  <p className="text-xs text-muted-dark">{preset.desc}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Major selector ─────────────────────────────────────────── */}
        <div className="glass-card p-6 space-y-4">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <GraduationCap size={17} className="text-dallas-green" />
            Field of Study / Major
          </h2>

          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => { setDropdownOpen(!dropdownOpen); setSearch(""); }}
              className="w-full flex items-center justify-between rounded-xl border border-surface-border bg-background/50 px-4 py-3 text-sm transition-all hover:border-muted-dark focus:outline-none"
              style={dropdownOpen ? { borderColor: "#46b533", boxShadow: "0 0 0 2px rgba(70,181,51,0.2)" } : {}}
            >
              <span className="font-medium">{selectedMajor}</span>
              <svg width="14" height="14" viewBox="0 0 14 14" className={`text-muted-dark transition-transform ${dropdownOpen ? "rotate-180" : ""}`}><path d="M2 4l5 5 5-5" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" /></svg>
            </button>

            {dropdownOpen && (
              <div className="absolute z-50 mt-2 w-full rounded-xl border border-surface-border bg-surface shadow-2xl overflow-hidden animate-scale-in">
                <div className="flex items-center gap-2 px-3 py-2.5 border-b border-surface-border">
                  <Search size={14} className="text-muted-dark flex-shrink-0" />
                  <input
                    autoFocus
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search majors…"
                    className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-dark outline-none"
                  />
                </div>
                <div className="max-h-52 overflow-y-auto">
                  {filtered.length === 0 ? (
                    <p className="px-4 py-3 text-xs text-muted-dark">No match found</p>
                  ) : (
                    filtered.map((major) => (
                      <button
                        key={major}
                        onClick={() => { setSelectedMajor(major); setDropdownOpen(false); setSearch(""); }}
                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-surface-hover flex items-center gap-2 ${major === selectedMajor ? "text-dallas-green bg-dallas-green/8" : "text-foreground"}`}
                      >
                        {major === selectedMajor && <CheckCircle2 size={13} />}
                        {major !== selectedMajor && <span className="w-4" />}
                        {major}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <p className="text-xs text-muted">
            Currently set to:{" "}
            <span className="font-semibold text-dallas-green">{selectedMajor}</span>
          </p>
        </div>

        {/* ── Resume upload ───────────────────────────────────────────── */}
        <div className="glass-card p-6 space-y-4">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Upload size={17} className="text-dallas-green" />
            Resume / CV
          </h2>

          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleFileDrop}
            onClick={() => fileRef.current?.click()}
            className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 cursor-pointer transition-all duration-300 ${dragOver
                ? "border-dallas-green bg-dallas-green/5 scale-[1.01]"
                : resumeFile
                  ? "border-dallas-green/50 bg-dallas-green/5"
                  : "border-surface-border hover:border-muted-dark hover:bg-surface-hover/30"
              }`}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.docx"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) setResumeFile(file.name);
              }}
            />
            {resumeFile ? (
              <>
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-dallas-green/20">
                  <CheckCircle2 size={28} className="text-dallas-green" />
                </div>
                <p className="text-sm font-semibold">{resumeFile}</p>
                <p className="mt-1 text-xs text-muted">Currently uploaded — click to replace</p>
                <button
                  onClick={(e) => { e.stopPropagation(); setResumeFile(null); }}
                  className="mt-3 flex items-center gap-1 text-xs text-muted hover:text-foreground transition-colors"
                >
                  <X size={13} /> Remove
                </button>
              </>
            ) : (
              <>
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-surface-hover">
                  <Upload size={26} className="text-muted" />
                </div>
                <p className="text-sm font-medium">Drag & drop your resume here</p>
                <p className="mt-1 text-xs text-muted-dark">PDF or DOCX, up to 10MB</p>
              </>
            )}
          </div>
          <p className="text-xs text-muted-dark text-center">
            Your resume is encrypted and only used to improve AI recommendations.
          </p>
        </div>

        {/* ── Save button ──────────────────────────────────────────────── */}
        {saveError && (
          <div className="rounded-xl border border-red-500/30 bg-red-950/50 px-4 py-3 text-sm text-red-300">
            {saveError}
          </div>
        )}
        <div className="flex justify-end pb-12">
          <button
            onClick={handleSave}
            disabled={saveState === "saving" || (!isDirty && saveState === "idle")}
            className="relative overflow-hidden rounded-xl px-8 py-3 text-sm font-semibold text-white shadow-lg transition-all duration-500 disabled:cursor-not-allowed flex items-center gap-2"
            style={{
              background:
                saveState === "saved"
                  ? "linear-gradient(135deg, #46b533, #3a9a2b)"
                  : saveState === "error"
                    ? "linear-gradient(135deg, #ef4444, #dc2626)"
                    : !isDirty && saveState === "idle"
                      ? "#52525b"
                      : "linear-gradient(135deg, #7c3aed, #6d28d9)",
              boxShadow:
                saveState === "saved"
                  ? "0 4px 20px rgba(70,181,51,0.35)"
                  : !isDirty && saveState === "idle"
                    ? "none"
                    : "0 4px 20px rgba(124,58,237,0.35)",
              opacity: !isDirty && saveState === "idle" ? 0.5 : 1,
            }}
          >
            {saveState === "saving" && (
              <>
                <Loader2 size={16} className="animate-spin" />
                Saving…
              </>
            )}
            {saveState === "saved" && (
              <>
                <CheckCircle2 size={16} /> Saved!
              </>
            )}
            {saveState === "error" && (
              <>
                <X size={16} /> Retry Save
              </>
            )}
            {saveState === "idle" && (
              <>
                <Save size={16} /> Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
