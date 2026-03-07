"use client";

import { useState, useRef, useEffect } from "react";
import { Upload, BookOpen, CheckCircle2, X, GraduationCap, Search } from "lucide-react";

const majors = [
  "Computer Science",
  "Data Science",
  "Software Engineering",
  "Artificial Intelligence",
  "Cybersecurity",
  "Information Technology",
  "Electrical Engineering",
  "Mathematics",
  "Physics",
  "Business Analytics",
  "Bioinformatics",
  "Cognitive Science",
  "Mechanical Engineering",
  "Statistics",
  "Economics",
];

const INITIAL_MAJOR = "Computer Science";
const INITIAL_RESUME = "resume_2024.pdf";

export default function SettingsPage() {
  const [selectedMajor, setSelectedMajor] = useState(INITIAL_MAJOR);
  const [search, setSearch] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [resumeFile, setResumeFile] = useState<string | null>(INITIAL_RESUME);
  const [dragOver, setDragOver] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [savedMajor, setSavedMajor] = useState(INITIAL_MAJOR);
  const [savedResume, setSavedResume] = useState<string | null>(INITIAL_RESUME);
  const fileRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isDirty = selectedMajor !== savedMajor || resumeFile !== savedResume;

  const filtered = majors.filter((m) =>
    m.toLowerCase().includes(search.toLowerCase())
  );

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

  const handleSave = () => {
    if (!isDirty) return;
    setSaveState("saving");
    setTimeout(() => {
      setSavedMajor(selectedMajor);
      setSavedResume(resumeFile);
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2500);
    }, 900);
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith(".pdf") || file.name.endsWith(".docx"))) {
      setResumeFile(file.name);
    }
  };

  return (
    <div className="min-h-screen px-4 py-8 md:px-8 lg:px-12">
      {/* Header */}
      <div className="mb-8 animate-fade-in">
        <div className="flex items-center gap-2 text-sm text-dallas-green mb-1">
          <BookOpen size={14} />
          <span className="font-medium">Preferences</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Settings</h1>
        <p className="mt-2 text-muted">Update your major and resume for better AI recommendations.</p>
      </div>

      <div className="max-w-2xl space-y-8 animate-fade-in stagger-1">
        {/* ── Major selector ─────────────────────────────────────────── */}
        <div className="glass-card p-6 space-y-4">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <GraduationCap size={17} className="text-dallas-green" />
            Field of Study / Major
          </h2>

          {/* Searchable dropdown */}
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
                {/* Search input */}
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
                {/* Options */}
                <div className="max-h-52 overflow-y-auto">
                  {filtered.length === 0 ? (
                    <p className="px-4 py-3 text-xs text-muted-dark">No match found</p>
                  ) : (
                    filtered.map((major) => (
                      <button
                        key={major}
                        onClick={() => { setSelectedMajor(major); setDropdownOpen(false); setSearch(""); }}
                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-surface-hover flex items-center gap-2 ${
                          major === selectedMajor ? "text-dallas-green bg-dallas-green/8" : "text-foreground"
                        }`}
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
            className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 cursor-pointer transition-all duration-300 ${
              dragOver
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
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saveState === "saving" || (!isDirty && saveState === "idle")}
            className="relative overflow-hidden rounded-xl px-8 py-3 text-sm font-semibold text-white shadow-lg transition-all duration-500 disabled:cursor-not-allowed"
            style={{
              background:
                saveState === "saved"
                  ? "linear-gradient(135deg, #46b533, #3a9a2b)"
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
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Saving…
              </span>
            )}
            {saveState === "saved" && (
              <span className="flex items-center gap-2">
                <CheckCircle2 size={16} /> Saved!
              </span>
            )}
            {saveState === "idle" && "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
