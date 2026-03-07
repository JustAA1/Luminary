"use client";

import { useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
} from "lucide-react";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface CalendarEvent {
  day: number;
  title: string;
  time: string;
  color: string;
  type: "study" | "deadline" | "review";
}

const sampleEvents: Record<string, CalendarEvent[]> = {
  "2026-3": [
    { day: 3, title: "React State Mgmt", time: "10:00 AM", color: "bg-blue-500", type: "study" },
    { day: 5, title: "Python Quiz", time: "2:00 PM", color: "bg-red-500", type: "deadline" },
    { day: 7, title: "Weekly Review", time: "9:00 AM", color: "bg-dallas-green", type: "review" },
    { day: 10, title: "Data Structures", time: "11:00 AM", color: "bg-purple-500", type: "study" },
    { day: 12, title: "ML Assignment Due", time: "11:59 PM", color: "bg-red-500", type: "deadline" },
    { day: 14, title: "Weekly Review", time: "9:00 AM", color: "bg-dallas-green", type: "review" },
    { day: 15, title: "CSS Animations", time: "3:00 PM", color: "bg-cyan-500", type: "study" },
    { day: 18, title: "API Integration", time: "10:00 AM", color: "bg-orange-500", type: "study" },
    { day: 20, title: "Project Milestone", time: "5:00 PM", color: "bg-red-500", type: "deadline" },
    { day: 21, title: "Weekly Review", time: "9:00 AM", color: "bg-dallas-green", type: "review" },
    { day: 24, title: "Neural Networks", time: "1:00 PM", color: "bg-purple-500", type: "study" },
    { day: 26, title: "Database Design", time: "10:00 AM", color: "bg-emerald-500", type: "study" },
    { day: 28, title: "Weekly Review", time: "9:00 AM", color: "bg-dallas-green", type: "review" },
  ],
};

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date(2026, 2, 7)); // March 2026
  const [view, setView] = useState<"month" | "week">("month");
  const [selectedDay, setSelectedDay] = useState<number | null>(7);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const today = 7; // Simulated today

  const key = `${year}-${month + 1}`;
  const events = sampleEvents[key] || [];

  const navigateMonth = (dir: number) => {
    setCurrentDate(new Date(year, month + dir, 1));
    setSelectedDay(null);
  };

  const selectedEvents = selectedDay
    ? events.filter((e) => e.day === selectedDay)
    : [];

  // Week view: get the week containing the selected day or today
  const focusDay = selectedDay || today;
  const focusDayOfWeek = new Date(year, month, focusDay).getDay();
  const weekStart = focusDay - focusDayOfWeek;

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
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
              Calendar
            </h1>
            <p className="mt-2 text-muted">
              Plan and track your learning schedule.
            </p>
          </div>
          <button className="flex items-center gap-2 rounded-xl bg-dallas-green px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-dallas-green/25 hover:bg-dallas-green-dark transition-all active:scale-[0.98] self-start">
            <ExternalLink size={16} />
            Sync with Google Calendar
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Calendar Grid */}
        <div className="rounded-2xl border border-surface-border bg-surface/50 p-4 md:p-6 animate-fade-in stagger-1">
          {/* Calendar header */}
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigateMonth(-1)}
                className="rounded-xl p-2 text-muted hover:bg-surface-hover hover:text-foreground transition-colors"
              >
                <ChevronLeft size={20} />
              </button>
              <h2 className="text-lg font-bold min-w-[180px] text-center">
                {MONTHS[month]} {year}
              </h2>
              <button
                onClick={() => navigateMonth(1)}
                className="rounded-xl p-2 text-muted hover:bg-surface-hover hover:text-foreground transition-colors"
              >
                <ChevronRight size={20} />
              </button>
            </div>
            <div className="flex rounded-xl bg-surface-hover p-1">
              {(["month", "week"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
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
              {/* Empty cells for days before the 1st */}
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`empty-${i}`} className="aspect-square p-1" />
              ))}

              {/* Day cells */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dayEvents = events.filter((e) => e.day === day);
                const isToday = day === today;
                const isSelected = day === selectedDay;

                return (
                  <button
                    key={day}
                    onClick={() => setSelectedDay(day)}
                    className={`aspect-square rounded-xl p-1 transition-all duration-200 flex flex-col items-center ${
                      isSelected
                        ? "bg-dallas-green/15 ring-1 ring-dallas-green"
                        : isToday
                        ? "bg-surface-hover"
                        : "hover:bg-surface-hover"
                    }`}
                  >
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${
                        isToday
                          ? "bg-dallas-green text-white font-bold"
                          : isSelected
                          ? "text-dallas-green font-bold"
                          : "text-muted"
                      }`}
                    >
                      {day}
                    </span>
                    {/* Event dots */}
                    {dayEvents.length > 0 && (
                      <div className="mt-1 flex gap-0.5">
                        {dayEvents.slice(0, 3).map((ev, j) => (
                          <div
                            key={j}
                            className={`h-1.5 w-1.5 rounded-full ${ev.color}`}
                          />
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            /* Week View */
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: 7 }).map((_, i) => {
                const day = weekStart + i;
                if (day < 1 || day > daysInMonth) {
                  return <div key={i} className="rounded-xl bg-background/20 p-3 min-h-[180px]" />;
                }
                const dayEvents = events.filter((e) => e.day === day);
                const isToday = day === today;

                return (
                  <div
                    key={i}
                    className={`rounded-xl border p-3 min-h-[180px] transition-colors ${
                      isToday
                        ? "border-dallas-green/30 bg-dallas-green/5"
                        : "border-surface-border bg-background/20"
                    }`}
                  >
                    <span
                      className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${
                        isToday
                          ? "bg-dallas-green text-white font-bold"
                          : "text-muted"
                      }`}
                    >
                      {day}
                    </span>
                    <div className="mt-2 space-y-1.5">
                      {dayEvents.map((ev, j) => (
                        <div
                          key={j}
                          className={`rounded-lg ${ev.color}/15 border-l-2 ${ev.color.replace("bg-", "border-")} px-2 py-1.5`}
                        >
                          <p className="text-[10px] font-semibold truncate">
                            {ev.title}
                          </p>
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
          <div className="mt-4 flex gap-4 text-xs text-muted">
            {[
              { label: "Study Session", color: "bg-blue-500" },
              { label: "Deadline", color: "bg-red-500" },
              { label: "Review", color: "bg-dallas-green" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-1.5">
                <div className={`h-2 w-2 rounded-full ${item.color}`} />
                {item.label}
              </div>
            ))}
          </div>
        </div>

        {/* Side Panel - Selected Day Details */}
        <div className="rounded-2xl border border-surface-border bg-surface/50 p-6 animate-fade-in stagger-2 h-fit lg:sticky lg:top-8">
          <h3 className="text-sm font-bold mb-1">
            {selectedDay
              ? `${MONTHS[month]} ${selectedDay}, ${year}`
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
                  className={`rounded-xl border border-surface-border bg-background/30 p-4 hover:bg-surface-hover transition-colors cursor-pointer`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`mt-0.5 h-3 w-3 rounded-full flex-shrink-0 ${ev.color}`}
                    />
                    <div>
                      <p className="text-sm font-semibold">{ev.title}</p>
                      <div className="mt-1 flex items-center gap-1 text-xs text-muted-dark">
                        <Clock size={12} />
                        {ev.time}
                      </div>
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

          {/* Upcoming deadlines */}
          <div className="mt-6 border-t border-surface-border pt-5">
            <h4 className="text-xs font-bold text-muted mb-3 uppercase tracking-wider">
              Upcoming Deadlines
            </h4>
            <div className="space-y-2">
              {events
                .filter((e) => e.type === "deadline" && e.day >= today)
                .slice(0, 3)
                .map((ev, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-lg px-3 py-2 text-xs hover:bg-surface-hover transition-colors"
                  >
                    <span className="font-medium">{ev.title}</span>
                    <span className="text-muted-dark">Mar {ev.day}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
