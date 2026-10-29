"use client";

import { useEffect, useState } from "react";

type Slot = "breakfast" | "lunch" | "snack" | "dinner";
type DayMeals = Partial<Record<Slot, string>>;
type PlanData = Record<string, DayMeals>;

const SLOTS: { key: Slot; label: string; chip: string }[] = [
  { key: "breakfast", label: "Breakfast", chip: "bg-amber-200 text-amber-900 dark:bg-amber-900/60 dark:text-amber-100" },
  { key: "lunch", label: "Lunch", chip: "bg-green-200 text-green-900 dark:bg-green-900/60 dark:text-green-100" },
  { key: "snack", label: "Snack", chip: "bg-blue-200 text-blue-900 dark:bg-blue-900/60 dark:text-blue-100" },
  { key: "dinner", label: "Dinner", chip: "bg-purple-200 text-purple-900 dark:bg-purple-900/60 dark:text-purple-100" },
];

const STORAGE_KEY = "meal-calendar-v1";
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const toKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function MealCalendar() {
  const [data, setData] = useState<PlanData>({});
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState<Date | null>(null);
  const [todayKey, setTodayKey] = useState("");
  const [editing, setEditing] = useState<Date | null>(null);
  const [draft, setDraft] = useState<DayMeals>({});

  // On first load (client only): set today's date and load saved meals
  useEffect(() => {
    const now = new Date();
    setView(new Date(now.getFullYear(), now.getMonth(), 1));
    setTodayKey(toKey(now));
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setData(JSON.parse(raw));
    } catch {}
    setLoaded(true);
  }, []);

  // Save whenever data changes (after the first load)
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {}
  }, [data, loaded]);

  if (!view) return null;

  // Build the grid: start on the Sunday before the 1st, show 5 or 6 weeks
  const start = new Date(view.getFullYear(), view.getMonth(), 1 - view.getDay());
  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    if (i >= 35 && d.getMonth() !== view.getMonth()) break;
    cells.push(d);
  }

  const shiftMonth = (n: number) =>
    setView(new Date(view.getFullYear(), view.getMonth() + n, 1));

  const goToday = () => {
    const now = new Date();
    setView(new Date(now.getFullYear(), now.getMonth(), 1));
    setTodayKey(toKey(now));
  };

  const openDay = (d: Date) => {
    setDraft({ ...(data[toKey(d)] ?? {}) });
    setEditing(d);
  };

  const save = () => {
    if (!editing) return;
    const cleaned: DayMeals = {};
    for (const { key } of SLOTS) {
      const v = draft[key]?.trim();
      if (v) cleaned[key] = v;
    }
    const next = { ...data };
    if (Object.keys(cleaned).length) next[toKey(editing)] = cleaned;
    else delete next[toKey(editing)];
    setData(next);
    setEditing(null);
  };

  return (
    <main className="mx-auto w-full max-w-5xl p-3">
      <header className="mb-3 flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-xl font-semibold">
          {view.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </h1>
        <button onClick={() => shiftMonth(-1)} aria-label="Previous month"
          className="rounded-lg border px-3 py-1.5 hover:bg-black/5 dark:hover:bg-white/10">‹</button>
        <button onClick={goToday}
          className="rounded-lg border px-3 py-1.5 hover:bg-black/5 dark:hover:bg-white/10">Today</button>
        <button onClick={() => shiftMonth(1)} aria-label="Next month"
          className="rounded-lg border px-3 py-1.5 hover:bg-black/5 dark:hover:bg-white/10">›</button>
      </header>

      <div className="grid grid-cols-7 overflow-hidden rounded-xl border">
        {WEEKDAYS.map((w) => (
          <div key={w} className="border-b p-1.5 text-center text-xs opacity-60">{w}</div>
        ))}
        {cells.map((d) => {
          const key = toKey(d);
          const day = data[key] ?? {};
          const outside = d.getMonth() !== view.getMonth();
          const isToday = key === todayKey;
          return (
            <div key={key} onClick={() => openDay(d)}
              className={`min-h-[72px] cursor-pointer overflow-hidden border-b border-r p-1 hover:bg-black/5 sm:min-h-[92px] dark:hover:bg-white/10 ${outside ? "opacity-40" : ""}`}>
              <div className={`mb-0.5 flex h-6 w-6 items-center justify-center rounded-full text-xs ${isToday ? "bg-green-700 text-white" : ""}`}>
                {d.getDate()}
              </div>
              {SLOTS.map(({ key: slot, chip }) =>
                day[slot] ? (
                  <div key={slot} title={day[slot]}
                    className={`mb-0.5 truncate rounded px-1 text-[10px] leading-4 sm:text-[11px] ${chip}`}>
                    {day[slot]}
                  </div>
                ) : null
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        {SLOTS.map(({ key, label, chip }) => (
          <span key={key} className={`rounded px-2 py-0.5 ${chip}`}>{label}</span>
        ))}
      </div>

      {editing && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setEditing(null)}>
          <div className="max-h-[90vh] w-full max-w-sm overflow-auto rounded-xl bg-white p-4 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
            onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-2 font-semibold">
              {editing.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </h2>
            {SLOTS.map(({ key, label }) => (
              <label key={key} className="mt-2 block text-xs opacity-70">
                {label}
                <input
                  value={draft[key] ?? ""}
                  onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && save()}
                  className="mt-1 w-full rounded-lg border bg-transparent p-2 text-sm opacity-100"
                />
              </label>
            ))}
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setEditing(null)} className="rounded-lg border px-3 py-1.5">Cancel</button>
              <button onClick={save} className="rounded-lg bg-green-700 px-3 py-1.5 text-white">Save</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}