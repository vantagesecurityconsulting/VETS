"use client";

import { useMemo, useState, useTransition } from "react";
import type { CatalogCategory, ClientRecord } from "@/lib/queries";
import {
  searchClientsAction,
  confirmVisitAction,
  type VisitLineInput,
} from "./actions";

type Step = "search" | "build" | "done";

export default function VisitFlow({
  catalog,
}: {
  catalog: CatalogCategory[];
}) {
  const [step, setStep] = useState<Step>("search");
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<ClientRecord[]>([]);
  const [searching, startSearch] = useTransition();
  const [client, setClient] = useState<ClientRecord | null>(null);

  // cart: itemId -> quantity
  const [cart, setCart] = useState<Record<number, number>>({});
  const [notes, setNotes] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<{
    pointsUsed: number;
    lines: { name: string; qty: number; points: number }[];
  } | null>(null);

  // Map itemId -> { name, pointValue, quantity, categoryName }
  const itemIndex = useMemo(() => {
    const idx = new Map<
      number,
      { name: string; pointValue: number; quantity: number; category: string }
    >();
    for (const cat of catalog) {
      for (const it of cat.items) {
        idx.set(it.id, {
          name: it.name,
          pointValue: cat.pointValue,
          quantity: it.quantity,
          category: cat.name,
        });
      }
    }
    return idx;
  }, [catalog]);

  const pointsUsed = useMemo(() => {
    let total = 0;
    for (const [id, qty] of Object.entries(cart)) {
      const info = itemIndex.get(Number(id));
      if (info) total += info.pointValue * qty;
    }
    return total;
  }, [cart, itemIndex]);

  const budget = client?.pointBudget ?? 0;
  const remaining = budget - pointsUsed;
  const overBudget = remaining < 0;

  const doSearch = (value: string) => {
    setTerm(value);
    startSearch(async () => {
      const r = await searchClientsAction(value);
      setResults(r);
    });
  };

  const setQty = (itemId: number, qty: number) => {
    setCart((prev) => {
      const next = { ...prev };
      if (qty <= 0) delete next[itemId];
      else next[itemId] = qty;
      return next;
    });
  };

  const confirm = async () => {
    if (!client) return;
    setConfirming(true);
    setError("");
    const lines: VisitLineInput[] = Object.entries(cart).map(([id, qty]) => ({
      itemId: Number(id),
      quantity: qty,
    }));
    const res = await confirmVisitAction(client.id, lines, notes);
    if (!res.success) {
      setError(res.error || "Could not save visit.");
      setConfirming(false);
      return;
    }
    setSummary({
      pointsUsed: res.pointsUsed ?? pointsUsed,
      lines: lines.map((l) => {
        const info = itemIndex.get(l.itemId);
        return {
          name: info ? `${info.category} — ${info.name}` : `Item ${l.itemId}`,
          qty: l.quantity,
          points: (info?.pointValue ?? 0) * l.quantity,
        };
      }),
    });
    setStep("done");
    setConfirming(false);
  };

  const reset = () => {
    setStep("search");
    setTerm("");
    setResults([]);
    setClient(null);
    setCart({});
    setNotes("");
    setSummary(null);
    setError("");
  };

  // ---------------------------------------------------------------- search
  if (step === "search") {
    return (
      <div className="mx-auto max-w-xl">
        <h1 className="font-heading text-2xl font-bold text-navy">
          Client Visit
        </h1>
        <p className="mt-1 text-charcoal/70">
          Search for a client by name or client ID.
        </p>
        <input
          autoFocus
          className="input mt-4"
          placeholder="e.g. VET-0042 or Jane Smith"
          value={term}
          onChange={(e) => doSearch(e.target.value)}
        />
        <div className="mt-4 space-y-2">
          {searching && (
            <p className="text-sm text-charcoal/50">Searching…</p>
          )}
          {!searching && term && results.length === 0 && (
            <p className="text-sm text-charcoal/50">No clients found.</p>
          )}
          {results.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                setClient(c);
                setStep("build");
              }}
              className="flex w-full items-center justify-between rounded-lg border border-black/5 bg-white p-4 text-left shadow-sm transition hover:border-navy/30"
            >
              <span>
                <span className="block font-semibold text-navy">{c.name}</span>
                <span className="text-sm text-charcoal/60">
                  {c.clientId} · Family of {c.familySize}
                </span>
              </span>
              <span className="rounded-full bg-navy/10 px-3 py-1 text-sm font-semibold text-navy">
                {c.pointBudget} pts
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------ done
  if (step === "done" && summary && client) {
    return (
      <div className="mx-auto max-w-xl">
        <div className="card border-l-4 border-l-green-600">
          <h1 className="font-heading text-2xl font-bold text-navy">
            Visit Recorded ✓
          </h1>
          <p className="mt-1 text-charcoal/70">
            {client.name} ({client.clientId})
          </p>
          <div className="mt-4 divide-y divide-black/5">
            {summary.lines.map((l, i) => (
              <div key={i} className="flex justify-between py-2 text-sm">
                <span>
                  {l.qty} × {l.name}
                </span>
                <span className="font-semibold text-navy">{l.points} pts</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-between border-t border-black/10 pt-3">
            <span className="font-semibold">Total points used</span>
            <span className="font-bold text-navy">{summary.pointsUsed}</span>
          </div>
          <button onClick={reset} className="btn-primary mt-6 w-full">
            New Visit
          </button>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------------------- build
  return (
    <div className="pb-28">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-navy">
            {client?.name}
          </h1>
          <p className="text-sm text-charcoal/60">
            {client?.clientId} · Family of {client?.familySize}
          </p>
        </div>
        <button onClick={reset} className="btn-outline">
          Change Client
        </button>
      </div>

      {error && (
        <p className="mt-4 rounded-md bg-military/10 px-3 py-2 text-sm font-semibold text-military">
          {error}
        </p>
      )}

      <div className="mt-5 space-y-5">
        {catalog.map((cat) => (
          <div key={cat.id} className="card">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-heading text-lg font-bold text-navy">
                {cat.name}
              </h2>
              <span className="rounded-full bg-gold/15 px-3 py-1 text-xs font-bold uppercase tracking-wide text-gold">
                {cat.pointValue} pt{cat.pointValue === 1 ? "" : "s"} each
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {cat.items.map((it) => {
                const qty = cart[it.id] ?? 0;
                const out = it.quantity <= 0;
                return (
                  <div
                    key={it.id}
                    className={`flex items-center justify-between rounded-lg border p-2.5 ${
                      qty > 0
                        ? "border-navy/40 bg-navy/5"
                        : "border-black/5 bg-offwhite"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-charcoal">
                        {it.name}
                      </p>
                      <p
                        className={`text-xs ${
                          out ? "text-military" : "text-charcoal/50"
                        }`}
                      >
                        {out ? "Out of stock" : `${it.quantity} in stock`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setQty(it.id, qty - 1)}
                        disabled={qty <= 0}
                        className="h-8 w-8 rounded-md bg-white text-lg font-bold text-navy shadow-sm disabled:opacity-30"
                      >
                        −
                      </button>
                      <span className="w-6 text-center text-sm font-bold">
                        {qty}
                      </span>
                      <button
                        onClick={() => setQty(it.id, qty + 1)}
                        className="h-8 w-8 rounded-md bg-navy text-lg font-bold text-white shadow-sm"
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        <div className="card">
          <label className="label" htmlFor="notes">
            Notes (optional)
          </label>
          <textarea
            id="notes"
            className="input"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. manager approved extra items"
          />
        </div>
      </div>

      {/* Sticky points bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-black/10 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-4 text-sm">
            <div>
              <span className="block text-xs uppercase text-charcoal/50">
                Used
              </span>
              <span className="text-lg font-bold text-navy">{pointsUsed}</span>
            </div>
            <div>
              <span className="block text-xs uppercase text-charcoal/50">
                Budget
              </span>
              <span className="text-lg font-bold text-charcoal">{budget}</span>
            </div>
            <div>
              <span className="block text-xs uppercase text-charcoal/50">
                Remaining
              </span>
              <span
                className={`text-lg font-bold ${
                  overBudget ? "text-military" : "text-green-700"
                }`}
              >
                {remaining}
              </span>
            </div>
          </div>
          <button
            onClick={confirm}
            disabled={confirming || pointsUsed === 0}
            className={overBudget ? "btn-danger" : "btn-primary"}
          >
            {confirming
              ? "Saving…"
              : overBudget
              ? "Confirm (Over Budget)"
              : "Confirm Visit"}
          </button>
        </div>
        {overBudget && (
          <p className="bg-military/10 px-4 py-1 text-center text-xs font-semibold text-military">
            Over budget by {Math.abs(remaining)} points — confirm only if a
            manager approved extras.
          </p>
        )}
      </div>
    </div>
  );
}
