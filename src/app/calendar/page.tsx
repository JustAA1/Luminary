"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle2,
  Loader2,
  RefreshCw,
  BookOpen,
} from "lucide-react";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface CalendarEvent {
  id?: string;
  day: number;
  month: number;
  year: number;
  title: string;
  time: string;
  color: string;
  type: "study" | "deadline" | "review" | "google" | "roadmap";
}

interface RoadmapTopic {
  id: string;
  title: string;
  status: "completed" | "in-progress" | "upcoming";
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

/** Distribute roadmap topics as study events starting from today, Mon/Wed/Fri schedule */
function buildRoadmapEvents(topics: RoadmapTopic[], startDate: Date): CalendarEvent[] {
  const STUDY_DAYS = [1, 3, 5]; // Mon, Wed, Fri
  const events: CalendarEvent[] = [];
  const upcoming = topics.filter((t) => t.status !== "completed");

  let cursor = new Date(startDate);
  // Advance to the next study day if today is not one
  while (!STUDY_DAYS.includes(cursor.getDay())) {
    cursor.setDate(cursor.getDate() + 1);
  }

  for (const topic of upcoming) {
    events.push({
      day: cursor.getDate(),
      month: cursor.getMonth(),
      year: cursor.getFullYear(),
      title: topic.title,
      time: "9:00 AM",
      color: topic.status === "in-progress" ? "bg-yellow-400" : "bg-dallas-green",
      type: "roadmap",
    });

    // Advance to next study day
    do {
      cursor.setDate(cursor.getDate() + 1);
    } while (!STUDY_DAYS.includes(cursor.getDay()));
  }

  return events;
}

/** Get Sunday of the week containing a given Date */
function getWeekSunday(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

export default function CalendarPage() {
  const todayRef = new Date(2026, 2, 7); // Simulated today: March 7, 2026

  // Month view state
  const [currentDate, setCurrentDate] = useState(new Date(2026, 2, 1));
  // Week view state — tracks the Sunday of the displayed week
  const [weekSunday, setWeekSunday] = useState(() => getWeekSunday(todayRef));

  const [view, setView] = useState<"month" | "week">("month");
  const [selectedDate, setSelectedDate] = useState<Date | null>(todayRef);

  // Google Calendar state
  const [googleEvents, setGoogleEvents] = useState<CalendarEvent[]>([]);
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(true);

  // Roadmap events (from localStorage)
  const [roadmapEvents, setRoadmapEvents] = useState<CalendarEvent[]>([]);

  // Load roadmap topics from localStorage and build calendar events
  useEffect(() => {
    try {
      const raw = localStorage.getItem("luminary_roadmap");
      if (!raw) return;
      const topics: RoadmapTopic[] = JSON.parse(raw);
      if (!Array.isArray(topics)) return;
      setRoadmapEvents(buildRoadmapEvents(topics, todayRef));
    } catch {
      // localStorage not available or parse error — silently ignore
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const fetchGoogleEvents = useCallback(async (y: number, m: number) => {
    try {
      const timeMin = new Date(y, m, 1).toISOString();
      const timeMax = new Date(y, m + 1, 0, 23, 59, 59).toISOString();

      const res = await fetch(
        `/api/calendar/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`
      );

      if (res.status === 401) {
        setIsGoogleConnected(false);
        setGoogleEvents([]);
        return;
      }

      if (res.ok) {
        const data = await res.json();
        setGoogleEvents((prev) => {
          // Merge: remove existing entries for this month, add new
          const others = prev.filter((e) => !(e.month === m && e.year === y));
          return [...others, ...(data.events || [])];
        });
        setIsGoogleConnected(true);
      }
    } catch {
      // Silently fail
    } finally {
      setIsLoadingGoogle(false);
    }
  }, []);

  useEffect(() => {
    fetchGoogleEvents(year, month);
  }, [fetchGoogleEvents, year, month]);

  // Also prefetch adjacent months for the week view when it spans month boundaries
  useEffect(() => {
    if (view === "week") {
      const weekEnd = new Date(weekSunday);
      weekEnd.setDate(weekEnd.getDate() + 6);
      if (weekEnd.getMonth() !== weekSunday.getMonth()) {
        fetchGoogleEvents(weekEnd.getFullYear(), weekEnd.getMonth());
      }
    }
  }, [view, weekSunday, fetchGoogleEvents]);

  const allEvents: CalendarEvent[] = [...roadmapEvents, ...googleEvents];

  // Navigation handlers — different per view
  const navigatePrev = () => {
    if (view === "week") {
      const newSunday = new Date(weekSunday);
      newSunday.setDate(newSunday.getDate() - 7);
      setWeekSunday(newSunday);
      // Sync month view to follow the week
      setCurrentDate(new Date(newSunday.getFullYear(), newSunday.getMonth(), 1));
    } else {
      setCurrentDate(new Date(year, month - 1, 1));
      setSelectedDate(null);
    }
  };

  const navigateNext = () => {
    if (view === "week") {
      const newSunday = new Date(weekSunday);
      newSunday.setDate(newSunday.getDate() + 7);
      setWeekSunday(newSunday);
      setCurrentDate(new Date(newSunday.getFullYear(), newSunday.getMonth(), 1));
    } else {
      setCurrentDate(new Date(year, month + 1, 1));
      setSelectedDate(null);
    }
  };

  // When switching to week view, reset weekSunday to match the selected date or today
  const handleViewChange = (v: "month" | "week") => {
    if (v === "week") {
      const anchor = selectedDate ?? todayRef;
      setWeekSunday(getWeekSunday(anchor));
      setCurrentDate(new Date(anchor.getFullYear(), anchor.getMonth(), 1));
    }
    setView(v);
  };

  // Events for a specific date
  const eventsForDate = (d: Date) =>
    allEvents.filter(
      (e) => e.day === d.getDate() && e.month === d.getMonth() && e.year === d.getFullYear()
    );

  // Selected day events
  const selectedEvents = selectedDate ? eventsForDate(selectedDate) : [];

  // Header label
  const headerLabel =
    view === "week"
      ? (() => {
          const weekEnd = new Date(weekSunday);
          weekEnd.setDate(weekEnd.getDate() + 6);
          if (weekSunday.getMonth() === weekEnd.getMonth()) {
            return `${MONTHS[weekSunday.getMonth()]} ${weekSunday.getDate()}–${weekEnd.getDate()}, ${weekSunday.getFullYear()}`;
          }
          return `${MONTHS[weekSunday.getMonth()].slice(0, 3)} ${weekSunday.getDate()} – ${MONTHS[weekEnd.getMonth()].slice(0, 3)} ${weekEnd.getDate()}, ${weekSunday.getFullYear()}`;
        })()
      : `${MONTHS[month]} ${year}`;

  const isToday = (d: Date) =>
    d.getDate() === todayRef.getDate() &&
    d.getMonth() === todayRef.getMonth() &&
    d.getFullYear() === todayRef.getFullYear();

  const isSelected = (d: Date) =>
    selectedDate !== null &&
    d.getDate() === selectedDate.getDate() &&
    d.getMonth() === selectedDate.getMonth() &&
    d.getFullYear() === selectedDate.getFullYear();

  const handleSync = async () => {
    if (!isGoogleConnected) return;
    try {
      setIsLoadingGoogle(true);
      const eventsToSync = roadmapEvents.map((ev) => ({
        title: ev.title,
        year: ev.year,
        month: ev.month,
        day: ev.day,
      }));
      const res = await fetch("/api/calendar/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events: eventsToSync }),
      });
      if (!res.ok) throw new Error("Failed to sync");
      fetchGoogleEvents(year, month);
    } catch (err) {
      console.error(err);
      alert("Failed to sync to Google Calendar");
    } finally {
      setIsLoadingGoogle(false);
    }
  };

  // 7 Date objects for the current week view
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekSunday);
    d.setDate(weekSunday.getDate() + i);
    return d;
  });

  return (
    <div className="min-h-screen px-4 py-8 md:px-8 lg:px-12">
      {/* Header */}
      <div className="mb-8 animate-fade-in">
        <div className="flex items-center gap-2 text-sm text-dallas-green mb-1">
          <CalendarDays size={14} />
          <span className="font-medium">Schedule</span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Calendar</h1>
            <p className="mt-2 text-muted">Plan and track your learning schedule.</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap self-start">
            {/* Roadmap event count badge */}
            {roadmapEvents.length > 0 && (
              <div className="flex items-center gap-2 rounded-xl bg-dallas-green/10 border border-dallas-green/20 px-4 py-2.5 text-sm font-semibold text-dallas-green">
                <BookOpen size={16} />
                {roadmapEvents.length} roadmap sessions scheduled
              </div>
            )}

            {/* Google Calendar status */}
            {isLoadingGoogle ? (
              <div className="flex items-center gap-2 rounded-xl bg-surface-hover px-5 py-2.5 text-sm font-semibold text-muted">
                <Loader2 size={16} className="animate-spin" />
                Loading…
              </div>
            ) : isGoogleConnected ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 rounded-xl bg-dallas-green/10 border border-dallas-green/20 px-4 py-2.5 text-sm font-semibold text-dallas-green">
                  <CheckCircle2 size={16} />
                  Connected
                </div>
                <button
                  onClick={handleSync}
                  className="flex items-center gap-2 rounded-xl bg-surface border border-surface-border hover:border-dallas-green/50 hover:bg-surface-hover px-4 py-2.5 text-sm font-semibold transition-all"
                  title="Sync roadmap sessions to Google Calendar"
                >
                  <RefreshCw size={16} />
                  Sync Roadmap
                </button>
              </div>
            ) : (
              <div className="rounded-xl bg-surface-hover px-4 py-2.5 text-sm text-muted">
                Sign in with Google to sync
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Calendar Grid */}
        <div className="rounded-2xl border border-surface-border bg-surface/50 p-4 md:p-6 animate-fade-in stagger-1">
          {/* Calendar header */}
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={navigatePrev}
                className="rounded-xl p-2 text-muted hover:bg-surface-hover hover:text-foreground transition-colors"
                aria-label={view === "week" ? "Previous week" : "Previous month"}
              >
                <ChevronLeft size={20} />
              </button>
              <h2 className="text-lg font-bold min-w-[220px] text-center">{headerLabel}</h2>
              <button
                onClick={navigateNext}
                className="rounded-xl p-2 text-muted hover:bg-surface-hover hover:text-foreground transition-colors"
                aria-label={view === "week" ? "Next week" : "Next month"}
              >
                <ChevronRight size={20} />
              </button>
            </div>
            <div className="flex rounded-xl bg-surface-hover p-1">
              {(["month", "week"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => handleViewChange(v)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                    view === v
                      ? "bg-dallas-green text-white shadow-sm"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-2">
            {DAYS.map((day) => (
              <div
                key={day}
                className="px-1 py-2 text-center text-xs font-semibold text-muted-dark"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar cells */}
          {view === "month" ? (
            <div className="grid grid-cols-7 gap-px">
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`empty-${i}`} className="aspect-square p-1" />
              ))}

              {Array.from({ length: daysInMonth }).map((_, i) => {
                const d = new Date(year, month, i + 1);
                const dayEvents = eventsForDate(d);
                const _isToday = isToday(d);
                const _isSelected = isSelected(d);

                return (
                  <button
                    key={i}
                    onClick={() => setSelectedDate(d)}
                    className={`aspect-square rounded-xl p-1 transition-all duration-200 flex flex-col items-center ${
                      _isSelected
                        ? "bg-dallas-green/15 ring-1 ring-dallas-green"
                        : "hover:bg-surface-hover"
                    }`}
                  >
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${
                        _isToday
                          ? "bg-dallas-green text-white font-bold"
                          : _isSelected
                            ? "text-dallas-green font-bold"
                            : "text-muted"
                      }`}
                    >
                      {i + 1}
                    </span>
                    {dayEvents.length > 0 && (
                      <div className="mt-1 flex gap-0.5">
                        {dayEvents.slice(0, 3).map((ev, j) => (
                          <div key={j} className={`h-1.5 w-1.5 rounded-full ${ev.color}`} />
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-2">
              {weekDays.map((d, i) => {
                const dayEvents = eventsForDate(d);
                const _isToday = isToday(d);
                const _isSelected = isSelected(d);

                return (
                  <div
                    key={i}
                    onClick={() => setSelectedDate(d)}
                    className={`rounded-xl border p-3 min-h-[180px] transition-colors cursor-pointer ${
                      _isToday
                        ? "border-dallas-green/30 bg-dallas-green/5"
                        : _isSelected
                          ? "border-dallas-green/50 bg-dallas-green/10"
                          : "border-surface-border bg-background/20 hover:bg-surface-hover/30"
                    }`}
                  >
                    <div className="mb-1 text-[10px] font-semibold text-muted-dark uppercase tracking-wider">
                      {MONTHS[d.getMonth()].slice(0, 3)}
                    </div>
                    <span
                      className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${
                        _isToday
                          ? "bg-dallas-green text-white font-bold"
                          : _isSelected
                            ? "bg-dallas-green/20 text-dallas-green font-bold"
                            : "text-muted"
                      }`}
                    >
                      {d.getDate()}
                    </span>
                    <div className="mt-2 space-y-1.5">
                      {dayEvents.map((ev, j) => (
                        <div
                          key={j}
                          className={`rounded-lg ${ev.color}/15 border-l-2 ${ev.color.replace("bg-", "border-")} px-2 py-1.5`}
                        >
                          <p className="text-[10px] font-semibold truncate">{ev.title}</p>
                          <p className="text-[9px] text-muted-dark">{ev.time}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Legend */}
          <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted">
            {[
              { label: "Roadmap Session", color: "bg-dallas-green" },
              { label: "In Progress", color: "bg-yellow-400" },
              { label: "Deadline", color: "bg-red-500" },
              { label: "Review", color: "bg-blue-500" },
              ...(isGoogleConnected ? [{ label: "Google Calendar", color: "bg-blue-500" }] : []),
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-1.5">
                <div className={`h-2 w-2 rounded-full ${item.color}`} />
                {item.label}
              </div>
            ))}
          </div>
        </div>

        {/* Side Panel */}
        <div className="rounded-2xl border border-surface-border bg-surface/50 p-6 animate-fade-in stagger-2 h-fit lg:sticky lg:top-8">
          <h3 className="text-sm font-bold mb-1">
            {selectedDate
              ? `${MONTHS[selectedDate.getMonth()]} ${selectedDate.getDate()}, ${selectedDate.getFullYear()}`
              : "Select a day"}
          </h3>
          <p className="text-xs text-muted mb-4">
            {selectedEvents.length} event{selectedEvents.length !== 1 ? "s" : ""} scheduled
          </p>

          {selectedEvents.length > 0 ? (
            <div className="space-y-3">
              {selectedEvents.map((ev, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-surface-border bg-background/30 p-4 hover:bg-surface-hover transition-colors cursor-pointer"
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 h-3 w-3 rounded-full flex-shrink-0 ${ev.color}`} />
                    <div>
                      <p className="text-sm font-semibold">{ev.title}</p>
                      <div className="mt-1 flex items-center gap-1 text-xs text-muted-dark">
                        <Clock size={12} />
                        {ev.time}
                      </div>
                      {ev.type === "google" && (
                        <span className="mt-1.5 inline-block rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-400">
                          Google Calendar
                        </span>
                      )}
                      {ev.type === "roadmap" && (
                        <span className="mt-1.5 inline-block rounded-full bg-dallas-green/10 px-2 py-0.5 text-[10px] font-medium text-dallas-green">
                          Roadmap Session
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center py-8 text-center">
              <CalendarDays size={32} className="mb-3 text-muted-dark" />
              <p className="text-sm text-muted">No events for this day</p>
              <p className="mt-1 text-xs text-muted-dark">
                Click a day with event dots to see details
              </p>
            </div>
          )}

          {/* Upcoming roadmap sessions */}
          {roadmapEvents.length > 0 && (
            <div className="mt-6 border-t border-surface-border pt-5">
              <h4 className="text-xs font-bold text-muted mb-3 uppercase tracking-wider">
                Upcoming Roadmap Sessions
              </h4>
              <div className="space-y-2">
                {roadmapEvents
                  .filter(
                    (e) =>
                      new Date(e.year, e.month, e.day) >= todayRef
                  )
                  .slice(0, 4)
                  .map((ev, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-lg px-3 py-2 text-xs hover:bg-surface-hover transition-colors"
                    >
                      <span className="font-medium truncate flex-1 mr-2">{ev.title}</span>
                      <span className="text-muted-dark whitespace-nowrap">
                        {MONTHS[ev.month].slice(0, 3)} {ev.day}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
