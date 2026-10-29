"use client";

import { useEffect, useState } from "react";

type Slot = "breakfast" | "lunch" | "snack" | "dinner";
type DayMeals = Partial<Record<Slot, string>>;
type PlanData = Record<string, DayMeals>;
type Meal = { id: string; name: string; slot: Slot | "any" };

const SLOTS: { key: Slot; label: string; chip: string }[] = [
  { key: "breakfast", label: "Breakfast", chip: "bg-amber-200 text-amber-900 dark:bg-amber-900/60 dark:text-amber-100" },
  { key: "lunch", label: "Lunch", chip: "bg-green-200 text-green-900 dark:bg-green-900/60 dark:text-green-100" },
  { key: "snack", label: "Snack", chip: "bg-blue-200 text-blue-900 dark:bg-blue-900/60 dark:text-blue-100" },
  { key: "dinner", label: "Dinner", chip: "bg-purple-200 text-purple-900 dark:bg-purple-900/60 dark:text-purple-100" },
];

const PLAN_KEY = "meal-calendar-v1";
const MEALS_KEY = "meal-calendar-meals-v1";
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const toKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const field =
  "mt-1 w-full rounded-lg border bg-white p-2 text-sm text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100";

export default function MealCalendar() {
  const [data, setData] = useState<PlanData>({});
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState<Date | null>(null);
  const [todayKey, setTodayKey] = useState("");
  const [editing, setEditing] = useState<Date | null>(null);
  const [draft, setDraft] = useState<DayMeals>({});
  const [mealsOpen, setMealsOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSlot, setNewSlot] = useState<Slot | "any">("breakfast");
  const [fillOpen, setFillOpen] = useState(false);
  const [fillRange, setFillRange] = useState<"week" | "month">("week");
  const [fillOverwrite, setFillOverwrite] = useState(false);
  const [prevData, setPrevData] = useState<PlanData | null>(null);

  // On first load (client only): set today's date and load saved data
  useEffect(() => {
    const now = new Date();
    setView(new Date(now.getFullYear(), now.getMonth(), 1));
    setTodayKey(toKey(now));
    try {
      const p = localStorage.getItem(PLAN_KEY);
      if (p) setData(JSON.parse(p));
      const m = localStorage.getItem(MEALS_KEY);
      if (m) setMeals(JSON.parse(m));
    } catch {}
    setLoaded(true);
  }, []);

  // Save whenever data changes (after the first load)
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(PLAN_KEY, JSON.stringify(data));
      localStorage.setItem(MEALS_KEY, JSON.stringify(meals));
    } catch {}
  }, [data, meals, loaded]);

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

  const addMeal = () => {
    const name = newName.trim();
    if (!name) return;
    const exists = meals.some(
      (m) => m.name.toLowerCase() === name.toLowerCase() && m.slot === newSlot
    );
    if (!exists) {
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      setMeals([...meals, { id, name, slot: newSlot }]);
    }
    setNewName("");
  };

  const removeMeal = (id: string) => setMeals(meals.filter((m) => m.id !== id));

  // Meals that can go in one slot: tagged for it, or tagged "any" (in list order)
  const poolFor = (slot: Slot) =>
    meals.filter((m) => m.slot === slot || m.slot === "any").map((m) => m.name);

  // Dropdown options for one slot in the day panel
  const optionsFor = (slot: Slot) => {
    const names = poolFor(slot);
    const current = draft[slot];
    if (current && !names.includes(current)) names.unshift(current);
    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
  };

  // Fill the week/month by rotating through each slot's saved meals
  const fill = () => {
    const now = new Date();
    let from: Date;
    let to: Date;
    if (fillRange === "week") {
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 6);
    } else {
      from = new Date(view.getFullYear(), view.getMonth(), 1);
      to = new Date(view.getFullYear(), view.getMonth() + 1, 0);
    }
    const next: PlanData = {};
    for (const k of Object.keys(data)) next[k] = { ...data[k] };

    const total = Math.round((to.getTime() - from.getTime()) / 86400000);
    for (let i = 0; i <= total; i++) {
      const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i);
      const key = toKey(d);
      for (const { key: slot } of SLOTS) {
        const pool = poolFor(slot);
        if (pool.length === 0) continue;
        if (!fillOverwrite && next[key]?.[slot]) continue;
        if (!next[key]) next[key] = {};
        next[key][slot] = pool[i % pool.length];
      }
    }
    setPrevData(data);
    setData(next);
    setFillOpen(false);
  };

  const undoFill = () => {
    if (!prevData) return;
    setData(prevData);
    setPrevData(null);
  };

  const btn = "rounded-lg border px-3 py-1.5 hover:bg-black/5 dark:hover:bg-white/10";
  const panel =
    "max-h-[90vh] w-full max-w-sm overflow-auto rounded-xl bg-white p-4 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100";

  return (
    <main className="mx-auto w-full max-w-5xl p-3">
      <header className="mb-3 flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-xl font-semibold">
          {view.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </h1>
        {prevData && <button onClick={undoFill} className={btn}>Undo fill</button>}
        <button onClick={() => setFillOpen(true)} className={btn}>Fill</button>
        <button onClick={() => setMealsOpen(true)} className={btn}>My meals</button>
        <button onClick={() => shiftMonth(-1)} aria-label="Previous month" className={btn}>‹</button>
        <button onClick={goToday} className={btn}>Today</button>
        <button onClick={() => shiftMonth(1)} aria-label="Next month" className={btn}>›</button>
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

      {/* Day panel: pick meals from your saved list */}
      {editing && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setEditing(null)}>
          <div className={panel} onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-2 font-semibold">
              {editing.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </h2>
            {meals.length === 0 && (
              <p className="mb-2 text-xs opacity-70">
                Your meal list is empty. Close this and add meals under “My meals” first.
              </p>
            )}
            {SLOTS.map(({ key, label }) => (
              <label key={key} className="mt-2 block text-xs opacity-70">
                {label}
                <select
                  value={draft[key] ?? ""}
                  onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                  className={field}
                >
                  <option value="">— none —</option>
                  {optionsFor(key).map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </label>
            ))}
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setEditing(null)} className="rounded-lg border px-3 py-1.5">Cancel</button>
              <button onClick={save} className="rounded-lg bg-green-700 px-3 py-1.5 text-white">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Fill panel: rotate saved meals across days */}
      {fillOpen && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setFillOpen(false)}>
          <div className={panel} onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-2 font-semibold">Fill the calendar</h2>
            <p className="mb-3 text-xs opacity-70">
              Your saved meals rotate across the days, in the order they appear in My meals.
            </p>

            <label className="block text-xs opacity-70">
              Fill
              <select
                value={fillRange}
                onChange={(e) => setFillRange(e.target.value as "week" | "month")}
                className={field}
              >
                <option value="week">Next 7 days (from today)</option>
                <option value="month">The whole month shown</option>
              </select>
            </label>

            <label className="mt-3 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={fillOverwrite}
                onChange={(e) => setFillOverwrite(e.target.checked)} />
              Replace meals already scheduled
            </label>

            <ul className="mt-3 space-y-1 text-xs">
              {SLOTS.map(({ key, label }) => {
                const pool = poolFor(key);
                return (
                  <li key={key} className="rounded-lg border px-2 py-1">
                    <span className="font-medium">{label}:</span>{" "}
                    <span className="opacity-70">
                      {pool.length ? pool.join(" → ") : "no meals saved (will be skipped)"}
                    </span>
                  </li>
                );
              })}
            </ul>

            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setFillOpen(false)} className="rounded-lg border px-3 py-1.5">Cancel</button>
              <button onClick={fill} disabled={meals.length === 0}
                className="rounded-lg bg-green-700 px-3 py-1.5 text-white disabled:opacity-40">
                Fill
              </button>
            </div>
          </div>
        </div>
      )}

      {/* My meals panel: manage the saved list */}
      {mealsOpen && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setMealsOpen(false)}>
          <div className={panel} onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-2 font-semibold">My meals</h2>

            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addMeal()}
              placeholder="Meal name, e.g. Poha"
              className={`${field} mt-0`}
            />
            <div className="mt-2 flex gap-2">
              <select
                value={newSlot}
                onChange={(e) => setNewSlot(e.target.value as Slot | "any")}
                className={`${field} mt-0 flex-1`}
                aria-label="Meal type"
              >
                <option value="any">Any</option>
                {SLOTS.map(({ key, label }) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
              <button onClick={addMeal} className="rounded-lg bg-green-700 px-4 text-white">Add</button>
            </div>

            <ul className="mt-3 space-y-1">
              {meals.length === 0 && (
                <li className="text-xs opacity-70">No meals yet. Add your first one above.</li>
              )}
              {meals.map((m) => {
                const chip = SLOTS.find((s) => s.key === m.slot)?.chip ?? "bg-neutral-200 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-100";
                return (
                  <li key={m.id} className="flex items-center gap-2 rounded-lg border px-2 py-1 text-sm">
                    <span className="flex-1 truncate">{m.name}</span>
                    <span className={`rounded px-1.5 text-[10px] ${chip}`}>
                      {m.slot === "any" ? "Any" : SLOTS.find((s) => s.key === m.slot)?.label}
                    </span>
                    <button onClick={() => removeMeal(m.id)} aria-label={`Delete ${m.name}`}
                      className="px-1 opacity-60 hover:opacity-100">×</button>
                  </li>
                );
              })}
            </ul>
            <div className="mt-4 flex justify-end">
              <button onClick={() => setMealsOpen(false)} className="rounded-lg border px-3 py-1.5">Done</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}