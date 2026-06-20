"use client";

import { useMemo, useState } from "react";
import type { CatalogCategory } from "@/lib/queries";
import { logDonationAction, type DonationLineInput } from "./actions";

interface LineState {
  quantity: number;
  expiry: string;
}

export default function DonationForm({
  catalog,
}: {
  catalog: CatalogCategory[];
}) {
  const [lines, setLines] = useState<Record<number, LineState>>({});
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ totalItems: number } | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return catalog;
    return catalog
      .map((c) => ({
        ...c,
        items: c.items.filter(
          (i) =>
            i.name.toLowerCase().includes(q) ||
            c.name.toLowerCase().includes(q)
        ),
      }))
      .filter((c) => c.items.length > 0);
  }, [catalog, search]);

  const totalQty = useMemo(
    () => Object.values(lines).reduce((s, l) => s + (l.quantity || 0), 0),
    [lines]
  );

  const update = (itemId: number, patch: Partial<LineState>) => {
    setLines((prev) => ({
      ...prev,
      [itemId]: {
        quantity: prev[itemId]?.quantity ?? 0,
        expiry: prev[itemId]?.expiry ?? "",
        ...patch,
      },
    }));
  };

  const submit = async () => {
    setSaving(true);
    setError("");
    const payload: DonationLineInput[] = Object.entries(lines)
      .filter(([, l]) => l.quantity > 0)
      .map(([id, l]) => ({
        itemId: Number(id),
        quantity: l.quantity,
        expiryDate: l.expiry || null,
      }));
    const res = await logDonationAction(payload, notes);
    if (!res.success) {
      setError(res.error || "Could not save donation.");
      setSaving(false);
      return;
    }
    setDone({ totalItems: res.totalItems ?? totalQty });
    setSaving(false);
  };

  const reset = () => {
    setLines({});
    setNotes("");
    setSearch("");
    setDone(null);
    setError("");
  };

  if (done) {
    return (
      <div className="mx-auto max-w-xl">
        <div className="card border-l-4 border-l-green-600">
          <h1 className="font-heading text-2xl font-bold text-navy">
            Donation Logged ✓
          </h1>
          <p className="mt-2 text-charcoal/70">
            {done.totalItems} item{done.totalItems === 1 ? "" : "s"} added to
            inventory.
          </p>
          <button onClick={reset} className="btn-primary mt-6 w-full">
            Log Another Donation
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-28">
      <h1 className="font-heading text-2xl font-bold text-navy">Log Donation</h1>
      <p className="mt-1 text-charcoal/70">
        Enter quantities received. Set an expiry date for perishables.
      </p>

      <input
        className="input mt-4"
        placeholder="Filter items…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {error && (
        <p className="mt-4 rounded-md bg-military/10 px-3 py-2 text-sm font-semibold text-military">
          {error}
        </p>
      )}

      <div className="mt-5 space-y-5">
        {filtered.map((cat) => (
          <div key={cat.id} className="card">
            <h2 className="mb-3 font-heading text-lg font-bold text-navy">
              {cat.name}
            </h2>
            <div className="space-y-2">
              {cat.items.map((it) => {
                const line = lines[it.id];
                return (
                  <div
                    key={it.id}
                    className="flex flex-wrap items-center gap-3 rounded-lg border border-black/5 bg-offwhite p-2.5"
                  >
                    <span className="min-w-[8rem] flex-1 text-sm font-medium text-charcoal">
                      {it.name}
                      <span className="ml-2 text-xs text-charcoal/40">
                        ({it.quantity} now)
                      </span>
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() =>
                          update(it.id, {
                            quantity: Math.max(0, (line?.quantity ?? 0) - 1),
                          })
                        }
                        className="h-8 w-8 rounded-md bg-white text-lg font-bold text-navy shadow-sm"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min={0}
                        value={line?.quantity ?? 0}
                        onChange={(e) =>
                          update(it.id, {
                            quantity: Math.max(0, Number(e.target.value) || 0),
                          })
                        }
                        className="w-14 rounded-md border border-navy/20 px-1 py-1 text-center text-sm"
                      />
                      <button
                        onClick={() =>
                          update(it.id, { quantity: (line?.quantity ?? 0) + 1 })
                        }
                        className="h-8 w-8 rounded-md bg-navy text-lg font-bold text-white shadow-sm"
                      >
                        +
                      </button>
                    </div>
                    <input
                      type="date"
                      value={line?.expiry ?? ""}
                      onChange={(e) => update(it.id, { expiry: e.target.value })}
                      className="rounded-md border border-navy/20 px-2 py-1 text-sm text-charcoal"
                      title="Expiry date (optional)"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="card mt-5">
        <label className="label" htmlFor="dnotes">
          Notes (optional)
        </label>
        <textarea
          id="dnotes"
          className="input"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-black/10 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <span className="text-sm">
            <span className="font-bold text-navy">{totalQty}</span> items to add
          </span>
          <button
            onClick={submit}
            disabled={saving || totalQty === 0}
            className="btn-primary"
          >
            {saving ? "Saving…" : "Submit Donation"}
          </button>
        </div>
      </div>
    </div>
  );
}
