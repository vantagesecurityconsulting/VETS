"use client";

import { useMemo, useState } from "react";
import type { CatalogCategory } from "@/lib/queries";
import { submitCountAction, type CountLineInput } from "./actions";

export default function CountForm({
  catalog,
}: {
  catalog: CatalogCategory[];
}) {
  const [categoryId, setCategoryId] = useState<number | "all">("all");
  const [counts, setCounts] = useState<Record<number, string>>({});
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{
    recorded: number;
    discrepancies: number;
  } | null>(null);

  const visible = useMemo(() => {
    if (categoryId === "all") return catalog;
    return catalog.filter((c) => c.id === categoryId);
  }, [catalog, categoryId]);

  const entered = useMemo(
    () => Object.values(counts).filter((v) => v.trim() !== "").length,
    [counts]
  );

  const submit = async () => {
    setSaving(true);
    setError("");
    const lines: CountLineInput[] = Object.entries(counts)
      .filter(([, v]) => v.trim() !== "")
      .map(([id, v]) => ({
        itemId: Number(id),
        countedQuantity: Math.max(0, Number(v) || 0),
      }));
    const res = await submitCountAction(lines, notes);
    if (!res.success) {
      setError(res.error || "Could not save count.");
      setSaving(false);
      return;
    }
    setDone({
      recorded: res.recorded ?? lines.length,
      discrepancies: res.discrepancies ?? 0,
    });
    setSaving(false);
  };

  const reset = () => {
    setCounts({});
    setNotes("");
    setDone(null);
    setError("");
  };

  if (done) {
    return (
      <div className="mx-auto max-w-xl">
        <div className="card border-l-4 border-l-green-600">
          <h1 className="font-heading text-2xl font-bold text-navy">
            Count Submitted ✓
          </h1>
          <p className="mt-2 text-charcoal/70">
            {done.recorded} item{done.recorded === 1 ? "" : "s"} counted.
          </p>
          <p className="text-sm text-charcoal/60">
            Discrepancies are available to managers in the audit report.
          </p>
          <button onClick={reset} className="btn-primary mt-6 w-full">
            New Count
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-28">
      <h1 className="font-heading text-2xl font-bold text-navy">Stock Count</h1>
      <p className="mt-1 text-charcoal/70">
        Enter the physical quantity you counted for each item.
      </p>

      <div className="mt-4">
        <label className="label" htmlFor="cat">
          Category
        </label>
        <select
          id="cat"
          className="input"
          value={categoryId}
          onChange={(e) =>
            setCategoryId(
              e.target.value === "all" ? "all" : Number(e.target.value)
            )
          }
        >
          <option value="all">All Categories</option>
          {catalog.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p className="mt-4 rounded-md bg-military/10 px-3 py-2 text-sm font-semibold text-military">
          {error}
        </p>
      )}

      <div className="mt-5 space-y-5">
        {visible.map((cat) => (
          <div key={cat.id} className="card">
            <h2 className="mb-3 font-heading text-lg font-bold text-navy">
              {cat.name}
            </h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {cat.items.map((it) => (
                <div
                  key={it.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-black/5 bg-offwhite p-2.5"
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-charcoal">
                    {it.name}
                  </span>
                  <input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    placeholder="—"
                    value={counts[it.id] ?? ""}
                    onChange={(e) =>
                      setCounts((prev) => ({
                        ...prev,
                        [it.id]: e.target.value,
                      }))
                    }
                    className="w-20 rounded-md border border-navy/20 px-2 py-1.5 text-center text-sm"
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="card mt-5">
        <label className="label" htmlFor="cnotes">
          Notes (optional)
        </label>
        <textarea
          id="cnotes"
          className="input"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-black/10 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <span className="text-sm">
            <span className="font-bold text-navy">{entered}</span> counts entered
          </span>
          <button
            onClick={submit}
            disabled={saving || entered === 0}
            className="btn-primary"
          >
            {saving ? "Saving…" : "Submit Count"}
          </button>
        </div>
      </div>
    </div>
  );
}
