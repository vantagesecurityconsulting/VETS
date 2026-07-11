"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { CatalogCategory } from "@/lib/queries";
import { submitOrderAction, clientLogoutAction, type OrderLineInput } from "../actions";

export interface RecentOrder {
  id: number;
  status: string;
  points: number;
  date: string;
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Awaiting the food bank",
  fulfilled: "Packed / on the way",
  cancelled: "Cancelled",
};

export default function ClientShop({
  clientName,
  clientId,
  budget,
  catalog,
  recentOrders,
}: {
  clientName: string;
  clientId: string;
  budget: number;
  catalog: CatalogCategory[];
  recentOrders: RecentOrder[];
}) {
  const router = useRouter();
  const [cart, setCart] = useState<Record<number, number>>({});
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ pointsUsed: number } | null>(null);

  const itemIndex = useMemo(() => {
    const idx = new Map<number, { name: string; pointValue: number; quantity: number; category: string; shopLimit: number | null }>();
    for (const cat of catalog)
      for (const it of cat.items)
        idx.set(it.id, { name: it.name, pointValue: cat.pointValue, quantity: it.quantity, category: cat.name, shopLimit: it.shopLimit });
    return idx;
  }, [catalog]);

  const pointsUsed = useMemo(() => {
    let t = 0;
    for (const [id, qty] of Object.entries(cart)) {
      const info = itemIndex.get(Number(id));
      if (info) t += info.pointValue * qty;
    }
    return t;
  }, [cart, itemIndex]);

  const remaining = budget - pointsUsed;
  const over = remaining < 0;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return catalog;
    return catalog
      .map((c) => ({
        ...c,
        items: c.items.filter(
          (i) =>
            i.name.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
        ),
      }))
      .filter((c) => c.items.length > 0);
  }, [catalog, search]);

  const setQty = (itemId: number, qty: number) =>
    setCart((prev) => {
      const limit = itemIndex.get(itemId)?.shopLimit ?? null;
      const capped = limit != null ? Math.min(qty, limit) : qty;
      const next = { ...prev };
      if (capped <= 0) delete next[itemId];
      else next[itemId] = capped;
      return next;
    });

  const submit = async () => {
    setSubmitting(true);
    setError("");
    const lines: OrderLineInput[] = Object.entries(cart).map(([id, qty]) => ({
      itemId: Number(id),
      quantity: qty,
    }));
    const res = await submitOrderAction(lines, notes);
    if (!res.success) {
      setError(res.error || "Could not submit your order.");
      setSubmitting(false);
      return;
    }
    setDone({ pointsUsed: res.pointsUsed ?? pointsUsed });
    setSubmitting(false);
  };

  const logout = async () => {
    await clientLogoutAction();
    router.push("/portal");
    router.refresh();
  };

  if (done) {
    return (
      <main className="mx-auto max-w-xl px-4 py-10">
        <div className="card border-l-4 border-l-green-600">
          <h1 className="font-heading text-2xl font-bold text-navy">Order Submitted ✓</h1>
          <p className="mt-2 text-charcoal/70">
            Thank you, {clientName}. Your order ({done.pointsUsed} credits) has been
            sent to the food bank. A volunteer will shop it and arrange delivery.
            You&apos;ll keep this on your file.
          </p>
          <div className="mt-5 flex gap-2">
            <button onClick={() => { setDone(null); setCart({}); setNotes(""); setSearch(""); router.refresh(); }} className="btn-primary">
              Start a New Order
            </button>
            <button onClick={logout} className="btn-outline">Sign Out</button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 pb-28 pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-navy">
            Welcome, {clientName}
          </h1>
          <p className="text-sm text-charcoal/60">{clientId} · Build your delivery order below</p>
        </div>
        <button onClick={logout} className="btn-outline text-sm">Sign Out</button>
      </div>

      {recentOrders.length > 0 && (
        <div className="card mt-4">
          <p className="mb-1 text-sm font-semibold text-navy">Your recent orders</p>
          <ul className="text-sm">
            {recentOrders.map((o) => (
              <li key={o.id} className="flex justify-between border-b border-black/5 py-1 last:border-0">
                <span>{o.date} · {o.points} credits</span>
                <span className="font-semibold text-navy">{STATUS_LABEL[o.status] ?? o.status}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <p className="mt-4 rounded-md bg-military/10 px-3 py-2 text-sm font-semibold text-military">{error}</p>
      )}

      <input
        className="input mt-4"
        placeholder="Search items…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="mt-5 space-y-5">
        {filtered.length === 0 && (
          <p className="text-sm text-charcoal/50">No items match “{search}”.</p>
        )}
        {filtered.map((cat) => (
          <div key={cat.id} className="card">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-heading text-lg font-bold text-navy">{cat.name}</h2>
              <span className="rounded-full bg-gold/15 px-3 py-1 text-xs font-bold uppercase text-gold">
                {cat.pointValue} pt{cat.pointValue === 1 ? "" : "s"} each
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {cat.items.map((it) => {
                const qty = cart[it.id] ?? 0;
                const out = it.quantity <= 0;
                return (
                  <div key={it.id} className={`flex items-center justify-between rounded-lg border p-2.5 ${qty > 0 ? "border-navy/40 bg-navy/5" : "border-black/5 bg-offwhite"}`}>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-charcoal">{it.name}</p>
                      <p className={`text-xs ${out ? "text-military" : "text-charcoal/50"}`}>
                        {out ? "Out of stock" : `${it.quantity} available`}
                        {it.shopLimit ? ` · limit ${it.shopLimit}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => setQty(it.id, qty - 1)} disabled={qty <= 0}
                        className="h-8 w-8 rounded-md bg-white text-lg font-bold text-navy shadow-sm disabled:opacity-30">−</button>
                      <span className="w-6 text-center text-sm font-bold">{qty}</span>
                      <button onClick={() => setQty(it.id, qty + 1)} disabled={out || qty >= it.quantity || (it.shopLimit != null && qty >= it.shopLimit)}
                        className="h-8 w-8 rounded-md bg-navy text-lg font-bold text-white shadow-sm disabled:opacity-30">+</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        <div className="card">
          <label className="label" htmlFor="notes">Notes for the food bank (optional)</label>
          <textarea id="notes" className="input" rows={2} value={notes}
            onChange={(e) => setNotes(e.target.value)} placeholder="e.g. delivery time preference, dietary needs" />
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-black/10 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-4 text-sm">
            <div><span className="block text-xs uppercase text-charcoal/50">Used</span><span className="text-lg font-bold text-navy">{pointsUsed}</span></div>
            <div><span className="block text-xs uppercase text-charcoal/50">Budget</span><span className="text-lg font-bold text-charcoal">{budget}</span></div>
            <div><span className="block text-xs uppercase text-charcoal/50">Left</span><span className={`text-lg font-bold ${over ? "text-military" : "text-green-700"}`}>{remaining}</span></div>
          </div>
          <button onClick={submit} disabled={submitting || pointsUsed === 0 || over}
            className="btn-primary disabled:opacity-50">
            {submitting ? "Sending…" : "Submit Order"}
          </button>
        </div>
        {over && (
          <p className="bg-military/10 px-4 py-1 text-center text-xs font-semibold text-military">
            Over your credit budget by {Math.abs(remaining)} — remove some items to submit.
          </p>
        )}
      </div>
    </main>
  );
}
