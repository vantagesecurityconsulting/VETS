"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { WEIGHT_UNIT } from "@/lib/units";
import { updateInventoryAction } from "./actions";

export interface InvRow {
  itemId: number;
  itemName: string;
  categoryName: string;
  quantity: number;
  unitPrice: number;
  unitWeight: number;
  expiryDate: string | null;
}

type Sort = "name" | "expiry" | "low";

function stockBadge(qty: number, low: number) {
  if (qty <= 0) return { label: "Out", cls: "bg-military/15 text-military" };
  if (qty <= low) return { label: "Low", cls: "bg-amber-100 text-amber-700" };
  return { label: "In stock", cls: "bg-green-100 text-green-700" };
}

function expiryClass(expiry: string | null, thresholdDays: number) {
  if (!expiry) return "";
  const days = Math.ceil(
    (new Date(expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  if (days < 0) return "text-military font-semibold";
  if (days <= thresholdDays) return "text-amber-600 font-semibold";
  return "text-charcoal/60";
}

export default function InventoryManager({ rows }: { rows: InvRow[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<Sort>("name");
  const [lowThreshold, setLowThreshold] = useState(5);
  const [expiryThreshold, setExpiryThreshold] = useState(7);
  const [editId, setEditId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = rows.filter(
      (r) =>
        r.itemName.toLowerCase().includes(q) ||
        r.categoryName.toLowerCase().includes(q)
    );
    if (sort === "name") {
      list = [...list].sort((a, b) =>
        `${a.categoryName}${a.itemName}`.localeCompare(
          `${b.categoryName}${b.itemName}`
        )
      );
    } else if (sort === "expiry") {
      list = [...list].sort((a, b) => {
        if (!a.expiryDate) return 1;
        if (!b.expiryDate) return -1;
        return a.expiryDate.localeCompare(b.expiryDate);
      });
    } else if (sort === "low") {
      list = [...list].sort((a, b) => a.quantity - b.quantity);
    }
    return list;
  }, [rows, search, sort]);

  // Total value of ALL current stock (for insurance) — independent of search.
  const totalValue = useMemo(
    () => rows.reduce((sum, r) => sum + r.quantity * r.unitPrice, 0),
    [rows]
  );
  const filteredValue = useMemo(
    () => filtered.reduce((sum, r) => sum + r.quantity * r.unitPrice, 0),
    [filtered]
  );
  const totalWeight = useMemo(
    () => rows.reduce((sum, r) => sum + r.quantity * r.unitWeight, 0),
    [rows]
  );

  const money = (n: number) =>
    n.toLocaleString("en-CA", { style: "currency", currency: "CAD" });

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-navy">Inventory</h1>
      <p className="mt-1 text-charcoal/70">
        Edit stock levels and expiry dates. Colours flag low stock and expiry.
      </p>

      {/* Total inventory value + weight (for insurance / gov records) */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-gold/30 bg-gold/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-charcoal/60">
            Total value of current inventory
          </p>
          <p className="text-3xl font-bold text-navy">{money(totalValue)}</p>
          <p className="text-xs text-charcoal/50">
            Estimated from average market prices — useful for insurance records.
          </p>
        </div>
        <div className="rounded-xl border border-navy/20 bg-navy/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-charcoal/60">
            Total weight of current inventory
          </p>
          <p className="text-3xl font-bold text-navy">
            {totalWeight.toLocaleString("en-CA", { maximumFractionDigits: 1 })}{" "}
            {WEIGHT_UNIT}
          </p>
          <p className="text-xs text-charcoal/50">
            Useful for government / poundage reporting.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[12rem]">
          <label className="label">Search</label>
          <input
            className="input"
            placeholder="Item or category…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Sort</label>
          <select
            className="input"
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
          >
            <option value="name">By name</option>
            <option value="expiry">Soonest expiry</option>
            <option value="low">Lowest stock</option>
          </select>
        </div>
        <div className="w-28">
          <label className="label">Low ≤</label>
          <input
            type="number"
            min={0}
            className="input"
            value={lowThreshold}
            onChange={(e) => setLowThreshold(Number(e.target.value) || 0)}
          />
        </div>
        <div className="w-32">
          <label className="label">Expiry warn (d)</label>
          <input
            type="number"
            min={0}
            className="input"
            value={expiryThreshold}
            onChange={(e) => setExpiryThreshold(Number(e.target.value) || 0)}
          />
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-black/5 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-navy/5 text-left text-navy">
            <tr>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">Item</th>
              <th className="px-3 py-2">Qty</th>
              <th className="px-3 py-2">Price</th>
              <th className="px-3 py-2">Value</th>
              <th className="px-3 py-2">Weight</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Expiry</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const badge = stockBadge(r.quantity, lowThreshold);
              return editId === r.itemId ? (
                <tr key={r.itemId} className="border-t border-black/5 bg-navy/5">
                  <td colSpan={9} className="px-3 py-2">
                    <form
                      action={async (fd) => {
                        await updateInventoryAction(fd);
                        setEditId(null);
                        router.refresh();
                      }}
                      className="flex flex-wrap items-end gap-2"
                    >
                      <input type="hidden" name="itemId" value={r.itemId} />
                      <span className="font-semibold text-navy">
                        {r.categoryName} — {r.itemName}
                      </span>
                      <div>
                        <label className="label">Quantity</label>
                        <input
                          name="quantity"
                          type="number"
                          min={0}
                          defaultValue={r.quantity}
                          className="input w-24"
                        />
                      </div>
                      <div>
                        <label className="label">Expiry</label>
                        <input
                          name="expiry"
                          type="date"
                          defaultValue={r.expiryDate ?? ""}
                          className="input"
                        />
                      </div>
                      <button className="btn-primary">Save</button>
                      <button
                        type="button"
                        onClick={() => setEditId(null)}
                        className="btn-outline"
                      >
                        Cancel
                      </button>
                    </form>
                  </td>
                </tr>
              ) : (
                <tr key={r.itemId} className="border-t border-black/5">
                  <td className="px-3 py-2 text-charcoal/70">{r.categoryName}</td>
                  <td className="px-3 py-2 font-medium">{r.itemName}</td>
                  <td className="px-3 py-2 font-bold text-navy">{r.quantity}</td>
                  <td className="px-3 py-2 text-charcoal/70">{money(r.unitPrice)}</td>
                  <td className="px-3 py-2 font-semibold text-navy">
                    {money(r.quantity * r.unitPrice)}
                  </td>
                  <td className="px-3 py-2 text-charcoal/70">
                    {(r.quantity * r.unitWeight).toLocaleString("en-CA", {
                      maximumFractionDigits: 1,
                    })}{" "}
                    {WEIGHT_UNIT}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${badge.cls}`}>
                      {badge.label}
                    </span>
                  </td>
                  <td className={`px-3 py-2 ${expiryClass(r.expiryDate, expiryThreshold)}`}>
                    {r.expiryDate ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => setEditId(r.itemId)}
                      className="btn-outline px-3 py-1 text-xs"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
