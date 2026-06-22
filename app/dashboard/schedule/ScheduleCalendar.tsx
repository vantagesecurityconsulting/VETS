"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ClientRecord } from "@/lib/queries";
import {
  searchClientsForApptAction,
  bookAppointmentAction,
  updateAppointmentStatusAction,
  deleteAppointmentAction,
} from "./actions";

export interface Appt {
  id: number;
  date: string; // ISO yyyy-mm-dd
  time: string | null;
  name: string;
  status: "scheduled" | "completed" | "cancelled" | "no_show";
  notes: string | null;
}

const STATUS_CLASS: Record<string, string> = {
  scheduled: "bg-navy/10 text-navy",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-charcoal/10 text-charcoal/50 line-through",
  no_show: "bg-military/10 text-military",
};
const STATUS_LABEL: Record<string, string> = {
  scheduled: "Scheduled",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No-show",
};

function addDays(iso: string, n: number) {
  const d = new Date(iso);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export default function ScheduleCalendar({
  weekStart,
  appts,
}: {
  weekStart: string;
  appts: Appt[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [showBook, setShowBook] = useState(false);
  const [bookDate, setBookDate] = useState(weekStart);

  // client search
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<ClientRecord[]>([]);
  const [chosen, setChosen] = useState<ClientRecord | null>(null);
  const [searching, startSearch] = useTransition();

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const dayName = (iso: string) =>
    new Date(iso).toLocaleDateString("en-CA", { weekday: "short" });
  const dayNum = (iso: string) =>
    new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric" });

  const goWeek = (delta: number) =>
    router.push(`/dashboard/schedule?week=${addDays(weekStart, delta * 7)}`);

  const doSearch = (v: string) => {
    setTerm(v);
    setChosen(null);
    startSearch(async () => setResults(await searchClientsForApptAction(v)));
  };

  const openBook = (date: string) => {
    setBookDate(date);
    setShowBook(true);
    setError("");
    setTerm("");
    setResults([]);
    setChosen(null);
  };

  const book = async (fd: FormData) => {
    setError("");
    const res = await bookAppointmentAction(fd);
    if (!res.success) return setError(res.error || "Failed.");
    setShowBook(false);
    router.refresh();
  };

  const setStatus = (id: number, status: Appt["status"]) =>
    startTransition(async () => {
      await updateAppointmentStatusAction(id, status);
      router.refresh();
    });

  const del = (id: number) =>
    startTransition(async () => {
      await deleteAppointmentAction(id);
      router.refresh();
    });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-bold text-navy">
          Shopping Schedule
        </h1>
        <button onClick={() => openBook(weekStart)} className="btn-primary">
          + Book Appointment
        </button>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button onClick={() => goWeek(-1)} className="btn-outline text-sm">
          ← Prev
        </button>
        <button
          onClick={() => router.push("/dashboard/schedule")}
          className="btn-outline text-sm"
        >
          This Week
        </button>
        <button onClick={() => goWeek(1)} className="btn-outline text-sm">
          Next →
        </button>
        <span className="ml-2 text-sm font-semibold text-charcoal/70">
          Week of {dayNum(weekStart)}
        </span>
      </div>

      {error && (
        <p className="mt-3 rounded-md bg-military/10 px-3 py-2 text-sm font-semibold text-military">
          {error}
        </p>
      )}

      {showBook && (
        <form action={book} className="card mt-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Client (search registered)</label>
              <input
                className="input"
                placeholder="Search name or ID…"
                value={chosen ? chosen.name : term}
                onChange={(e) => doSearch(e.target.value)}
              />
              {!chosen && term && (
                <div className="mt-1 max-h-40 overflow-y-auto rounded-md border border-black/10 bg-white">
                  {searching && (
                    <p className="px-3 py-2 text-sm text-charcoal/50">Searching…</p>
                  )}
                  {!searching && results.length === 0 && (
                    <p className="px-3 py-2 text-sm text-charcoal/50">
                      No match — or just type a name below.
                    </p>
                  )}
                  {results.map((c) => (
                    <button
                      type="button"
                      key={c.id}
                      onClick={() => {
                        setChosen(c);
                        setResults([]);
                      }}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-navy/5"
                    >
                      {c.name} · {c.clientId}
                    </button>
                  ))}
                </div>
              )}
              <input type="hidden" name="clientId" value={chosen?.id ?? ""} />
            </div>
            <div>
              <label className="label">…or name (walk-in / not registered)</label>
              <input name="clientName" className="input" placeholder="Name" defaultValue="" />
            </div>
            <div>
              <label className="label">Date</label>
              <input
                name="date"
                type="date"
                className="input"
                value={bookDate}
                onChange={(e) => setBookDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">Time</label>
              <input name="time" type="time" className="input" />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Notes (optional)</label>
              <input name="notes" className="input" />
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button className="btn-primary">Book</button>
            <button type="button" onClick={() => setShowBook(false)} className="btn-outline">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Week grid */}
      <div className="mt-4 grid gap-3 md:grid-cols-7">
        {days.map((d) => {
          const dayAppts = appts.filter((a) => a.date === d);
          const isToday = d === new Date().toISOString().slice(0, 10);
          return (
            <div
              key={d}
              className={`rounded-xl border bg-white p-2 shadow-sm ${
                isToday ? "border-gold" : "border-black/5"
              }`}
            >
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-charcoal/50">
                    {dayName(d)}
                  </p>
                  <p className="text-sm font-bold text-navy">{dayNum(d)}</p>
                </div>
                <button
                  onClick={() => openBook(d)}
                  className="rounded-full bg-navy/10 px-2 text-lg font-bold text-navy"
                  title="Book on this day"
                >
                  +
                </button>
              </div>
              <div className="space-y-1.5">
                {dayAppts.length === 0 && (
                  <p className="text-xs text-charcoal/30">—</p>
                )}
                {dayAppts.map((a) => (
                  <div
                    key={a.id}
                    className="rounded-md border border-black/5 bg-offwhite p-1.5 text-xs"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-semibold text-charcoal">
                        {a.time ? `${a.time} · ` : ""}
                        {a.name}
                      </span>
                    </div>
                    {a.notes && (
                      <p className="text-[11px] text-charcoal/50">{a.notes}</p>
                    )}
                    <span
                      className={`mt-1 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                        STATUS_CLASS[a.status]
                      }`}
                    >
                      {STATUS_LABEL[a.status]}
                    </span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {a.status !== "completed" && (
                        <button onClick={() => setStatus(a.id, "completed")} className="text-[10px] font-semibold text-green-700">
                          ✓ Done
                        </button>
                      )}
                      {a.status !== "no_show" && (
                        <button onClick={() => setStatus(a.id, "no_show")} className="text-[10px] font-semibold text-military">
                          No-show
                        </button>
                      )}
                      {a.status !== "cancelled" && (
                        <button onClick={() => setStatus(a.id, "cancelled")} className="text-[10px] font-semibold text-charcoal/50">
                          Cancel
                        </button>
                      )}
                      <button onClick={() => del(a.id)} className="text-[10px] font-semibold text-charcoal/40">
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
