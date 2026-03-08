"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ArrowLeft,
  Brain,
  Heart,
  Clock,
  FileUp,
  Upload,
  CheckCircle2,
  Sparkles,
  X,
  Loader2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { riqeOnboard } from "@/lib/riqe";

const skillLevels = [
  { id: "programming", label: "Programming (Python/C++)" },
  { id: "math", label: "Mathematics & Statistics" },
  { id: "finance", label: "Finance & Markets" },
  { id: "stochastic-calc", label: "Stochastic Calculus" },
  { id: "ml", label: "Machine Learning" },
  { id: "data-science", label: "Data Science" },
];

const hobbies = [
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

const steps = [
  { icon: Brain, label: "Skills", desc: "Assess your current level" },
  { icon: Heart, label: "Interests", desc: "What excites you" },
  { icon: Clock, label: "Timeframe", desc: "Your commitment" },
  { icon: FileUp, label: "Resume", desc: "Upload your background" },
];

/** Convert 0-4 integer slider value to 0.0-1.0 float for the ML pipeline. */
function normalizeSkill(v: number): number {
  return Math.min(1, Math.max(0, v / 4));
}

/** Derive a learning timeframe in weeks from hours-per-week commitment. */
function hoursToWeeks(hoursPerWeek: number): number {
  // ~200 total hours to cover the roadmap; clamp 4–52 weeks.
  return Math.min(52, Math.max(4, Math.round(200 / Math.max(1, hoursPerWeek))));
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [skills, setSkills] = useState<Record<string, number>>({});
  const [selectedHobbies, setSelectedHobbies] = useState<string[]>([]);
  const [hoursPerWeek, setHoursPerWeek] = useState(10);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const toggleHobby = (hobby: string) => {
    setSelectedHobbies((prev) =>
      prev.includes(hobby)
        ? prev.filter((h) => h !== hobby)
        : [...prev, hobby]
    );
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith(".pdf") || file.name.endsWith(".docx"))) {
      setUploadedFile(file.name);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setUploadedFile(file.name);
  };

  const handleStartLearning = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const supabase = createClient();
      if (!supabase) {
        router.push("/roadmap");
        return;
      }

      const authUser = (await supabase.auth.getUser()).data.user;

      const userId = authUser?.id ?? null;
      const userEmail = authUser?.email ?? null;

      if (!userId || !userEmail) {
        router.push("/roadmap");
        return;
      }

      // Normalize skill scores from 0-4 integers to 0.0-1.0 floats.
      const skillScores: Record<string, number> = {};
      for (const s of skillLevels) {
        skillScores[s.id] = normalizeSkill(skills[s.id] ?? 0);
      }

      // Build resume text from uploaded filename + interests as context.
      const resumeText = [
        uploadedFile ? `Resume: ${uploadedFile}` : "",
        selectedHobbies.length > 0 ? `Interests: ${selectedHobbies.join(", ")}` : "",
        "Background: quantitative methods, data, and technology.",
      ].filter(Boolean).join(" ");

      // Persist onboarding data to Supabase profiles
      const profilePayload = {
        skills: skills,
        hobbies: selectedHobbies,
        hours_per_week: hoursPerWeek,
        onboarding_completed: true,
        updated_at: new Date().toISOString(),
      };

      // Try update by id first (matches RLS policy directly)
      const { data: updatedById, error: errById } = await supabase
        .from("profiles")
        .update(profilePayload)
        .eq("id", userId)
        .select();

      if (errById) {
        console.error("Onboarding profile update by id failed:", errById.message);
      }

      // Fallback: if id-based update returned no rows, try by email
      if (!updatedById || updatedById.length === 0) {
        const { data: updatedByEmail, error: errByEmail } = await supabase
          .from("profiles")
          .update(profilePayload)
          .eq("email", userEmail)
          .select();

        if (errByEmail) {
          console.error("Onboarding profile update by email failed:", errByEmail.message);
        }
        if (!updatedByEmail || updatedByEmail.length === 0) {
          console.error("Onboarding: no profile row updated. The row may not exist.");
        }
      }

      // Persist to profile_data for dashboard
      const skillsGained: Record<string, number> = {};
      for (const [k, v] of Object.entries(skills)) {
        skillsGained[k] = typeof v === "number" ? Math.min(100, v * 25) : 0;
      }
      await supabase.from("profile_data").upsert({
        user_id: userId,
        courses_active: [],
        hours_learned: 0,
        current_streak: 0,
        skills_gained: skillsGained,
        past_coursework: [],
        overall_progress_percentage: 0,
        topics_done: 0,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

      // Call ML pipeline (non-blocking for navigation)
      try {
        await riqeOnboard({
          user_id: userId,
          resume_text: resumeText,
          skill_scores: skillScores,
          interests: selectedHobbies.length > 0 ? selectedHobbies : ["quantitative finance"],
          field_of_study: "Quantitative Finance",
          timeframe_weeks: hoursToWeeks(hoursPerWeek),
        });
      } catch (mlErr) {
        console.error("ML pipeline error (non-fatal):", mlErr);
      }

      router.push("/roadmap");
    } catch (e) {
      console.error("Onboarding error:", e);
      setSubmitError(
        e instanceof Error && e.message.length < 200
          ? e.message
          : "Could not initialise the ML pipeline. You can still generate your roadmap from the Roadmap page."
      );
      setTimeout(() => router.push("/roadmap"), 3000);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      {/* Background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-1/3 left-1/3 h-[400px] w-[400px] rounded-full bg-dallas-green/6 blur-[120px]" />
      </div>

      <div className="relative w-full max-w-2xl animate-fade-in">
        {/* Progress bar */}
        <div className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            {steps.map((s, i) => (
              <div
                key={i}
                className={`flex items-center gap-2 text-xs font-medium transition-colors ${
                  i <= step ? "text-dallas-green" : "text-muted-dark"
                }`}
              >
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all duration-300 ${
                    i < step
                      ? "border-dallas-green bg-dallas-green text-white"
                      : i === step
                      ? "border-dallas-green text-dallas-green"
                      : "border-surface-border text-muted-dark"
                  }`}
                >
                  {i < step ? (
                    <CheckCircle2 size={16} />
                  ) : (
                    <s.icon size={14} />
                  )}
                </div>
                <span className="hidden sm:inline">{s.label}</span>
              </div>
            ))}
          </div>
          <div className="h-1.5 w-full rounded-full bg-surface">
            <div
              className="h-full rounded-full bg-dallas-green transition-all duration-500 ease-out"
              style={{ width: `${((step + 1) / steps.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-surface-border bg-surface/80 backdrop-blur-xl p-8 shadow-2xl shadow-black/20">
          {/* Step 1: Skills */}
          {step === 0 && (
            <div className="animate-fade-in">
              <h2 className="mb-2 text-2xl font-bold">
                How would you rate your skills?
              </h2>
              <p className="mb-8 text-sm text-muted">
                Help us understand your current level in each area.
              </p>

              <div className="space-y-6">
                {skillLevels.map((skill) => (
                  <div key={skill.id}>
                    <div className="mb-2 flex items-center justify-between">
                      <label className="text-sm font-medium">
                        {skill.label}
                      </label>
                      <span className="text-xs text-dallas-green font-semibold">
                        {["Beginner", "Elementary", "Intermediate", "Advanced", "Expert"][
                          (skills[skill.id] || 0)
                        ]}
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
                      {["Beg", "Elem", "Inter", "Adv", "Expert"].map(
                        (label, i) => (
                          <span
                            key={i}
                            className={`text-[10px] ${
                              (skills[skill.id] || 0) === i
                                ? "text-dallas-green"
                                : "text-muted-dark"
                            }`}
                          >
                            {label}
                          </span>
                        )
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Hobbies */}
          {step === 1 && (
            <div className="animate-fade-in">
              <h2 className="mb-2 text-2xl font-bold">
                What are you interested in?
              </h2>
              <p className="mb-8 text-sm text-muted">
                Select topics that excite you. We&apos;ll personalize your
                learning path.
              </p>

              <div className="flex flex-wrap gap-3">
                {hobbies.map((hobby) => {
                  const selected = selectedHobbies.includes(hobby);
                  return (
                    <button
                      key={hobby}
                      onClick={() => toggleHobby(hobby)}
                      className={`rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200 active:scale-95 ${
                        selected
                          ? "border-dallas-green bg-dallas-green/15 text-dallas-green shadow-sm shadow-dallas-green/10"
                          : "border-surface-border text-muted hover:border-muted-dark hover:text-foreground"
                      }`}
                    >
                      {selected && (
                        <CheckCircle2
                          size={14}
                          className="mr-1.5 inline-block"
                        />
                      )}
                      {hobby}
                    </button>
                  );
                })}
              </div>

              {selectedHobbies.length > 0 && (
                <p className="mt-6 text-xs text-muted">
                  <span className="font-semibold text-dallas-green">
                    {selectedHobbies.length}
                  </span>{" "}
                  topics selected
                </p>
              )}
            </div>
          )}

          {/* Step 3: Timeframe */}
          {step === 2 && (
            <div className="animate-fade-in">
              <h2 className="mb-2 text-2xl font-bold">
                How much time can you commit?
              </h2>
              <p className="mb-8 text-sm text-muted">
                We&apos;ll adjust your learning pace accordingly.
              </p>

              <div className="flex flex-col items-center">
                <div className="relative mb-8 flex h-40 w-40 items-center justify-center">
                  <svg className="absolute inset-0" viewBox="0 0 160 160">
                    <circle
                      cx="80"
                      cy="80"
                      r="70"
                      fill="none"
                      stroke="currentColor"
                      className="text-surface-hover"
                      strokeWidth="8"
                    />
                    <circle
                      cx="80"
                      cy="80"
                      r="70"
                      fill="none"
                      stroke="currentColor"
                      className="text-dallas-green"
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={`${(hoursPerWeek / 40) * 440} 440`}
                      transform="rotate(-90 80 80)"
                      style={{ transition: "stroke-dasharray 0.3s ease" }}
                    />
                  </svg>
                  <div className="text-center">
                    <span className="text-4xl font-bold text-dallas-green">
                      {hoursPerWeek}
                    </span>
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

                <div className="mt-4 flex w-full max-w-xs justify-between">
                  <span className="text-xs text-muted-dark">1 hr</span>
                  <span className="text-xs text-muted-dark">20 hrs</span>
                  <span className="text-xs text-muted-dark">40 hrs</span>
                </div>

                <div className="mt-8 grid w-full grid-cols-3 gap-3">
                  {[
                    {
                      hours: 5,
                      label: "Casual",
                      desc: "~1 hr/day",
                    },
                    {
                      hours: 15,
                      label: "Committed",
                      desc: "~2 hrs/day",
                    },
                    {
                      hours: 30,
                      label: "Intensive",
                      desc: "~4 hrs/day",
                    },
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
          )}

          {/* Step 4: Resume Upload */}
          {step === 3 && (
            <div className="animate-fade-in">
              <h2 className="mb-2 text-2xl font-bold">Upload your resume</h2>
              <p className="mb-8 text-sm text-muted">
                We&apos;ll extract your experience to personalize recommendations.
                Accepts PDF or DOCX.
              </p>

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleFileDrop}
                className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-12 transition-all duration-300 ${
                  dragOver
                    ? "border-dallas-green bg-dallas-green/5 scale-[1.02]"
                    : uploadedFile
                    ? "border-dallas-green/50 bg-dallas-green/5"
                    : "border-surface-border hover:border-muted-dark"
                }`}
              >
                {uploadedFile ? (
                  <>
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-dallas-green/20">
                      <CheckCircle2
                        size={32}
                        className="text-dallas-green"
                      />
                    </div>
                    <p className="text-sm font-semibold">{uploadedFile}</p>
                    <p className="mt-1 text-xs text-muted">
                      Uploaded successfully
                    </p>
                    <button
                      onClick={() => setUploadedFile(null)}
                      className="mt-4 flex items-center gap-1 text-xs text-muted hover:text-foreground transition-colors"
                    >
                      <X size={14} />
                      Remove
                    </button>
                  </>
                ) : (
                  <>
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface-hover">
                      <Upload size={28} className="text-muted" />
                    </div>
                    <p className="text-sm font-medium">
                      Drag & drop your resume here
                    </p>
                    <p className="mt-1 text-xs text-muted-dark">
                      or click to browse
                    </p>
                    <input
                      type="file"
                      accept=".pdf,.docx"
                      onChange={handleFileInput}
                      className="absolute inset-0 cursor-pointer opacity-0"
                    />
                  </>
                )}
              </div>

              <p className="mt-4 text-center text-xs text-muted-dark">
                Your data is encrypted and only used to improve recommendations.
              </p>

              {/* Inline error shown if pipeline init fails */}
              {submitError && (
                <div className="mt-4 rounded-xl border border-red-500/30 bg-red-950/60 px-4 py-3 text-xs text-red-300">
                  {submitError}
                </div>
              )}
            </div>
          )}

          {/* Navigation buttons */}
          <div className="mt-8 flex items-center justify-between">
            <button
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition-all duration-200 ${
                step === 0
                  ? "invisible"
                  : "text-muted hover:bg-surface-hover hover:text-foreground"
              }`}
            >
              <ArrowLeft size={16} />
              Back
            </button>

            {step < 3 ? (
              <button
                onClick={() => setStep((s) => s + 1)}
                className="flex items-center gap-2 rounded-xl bg-dallas-green px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-dallas-green/25 hover:bg-dallas-green-dark transition-all duration-200 active:scale-[0.98]"
              >
                Continue
                <ArrowRight size={16} />
              </button>
            ) : (
              <button
                onClick={handleStartLearning}
                disabled={submitting}
                className="flex items-center gap-2 rounded-xl bg-dallas-green px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-dallas-green/25 hover:bg-dallas-green-dark transition-all duration-200 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Building your roadmap…
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    Start Learning
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
