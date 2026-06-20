"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ClientRecord } from "@/lib/queries";
import {
  createClientAction,
  updateClientAction,
  toggleClientActiveAction,
  getClientHistoryAction,
  type VisitHistoryRow,
} from "./actions";

function defaultBudget(familySize: number) {
  return 60 + (Math.max(1, familySize) - 1) * 5;
}

export default function ClientsManager({
  clients,
}: {
  clients: ClientRecord[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [historyFor, setHistoryFor] = useState<number | null>(null);
  const [history, setHistory] = useState<VisitHistoryRow[]>([]);
  const [search, setSearch] = useState("");

  const filtered = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.clientId.toLowerCase().includes(search.toLowerCase())
  );

  const onAdd = async (fd: FormData) => {
    setError("");
    const res = await createClientAction(fd);
    if (!res.success) return setError(res.error || "Failed.");
    setShowAdd(false);
    router.refresh();
  };

  const onEdit = async (fd: FormData) => {
    setError("");
    const res = await updateClientAction(fd);
    if (!res.success) return setError(res.error || "Failed.");
    setEditId(null);
    router.refresh();
  };

  const toggleActive = (id: number, active: boolean) => {
    startTransition(async () => {
      await toggleClientActiveAction(id, active);
      router.refresh();
    });
  };

  const loadHistory = async (id: number) => {
    if (historyFor === id) {
      setHistoryFor(null);
      return;
    }
    const rows = await getClientHistoryAction(id);
    setHistory(rows);
    setHistoryFor(id);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-bold text-navy">Clients</h1>
        <button onClick={() => setShowAdd((s) => !s)} className="btn-primary">
          {showAdd ? "Cancel" : "+ Add Client"}
        </button>
      </div>

      {error && (
        <p className="mt-3 rounded-md bg-military/10 px-3 py-2 text-sm font-semibold text-military">
          {error}
        </p>
      )}

      {showAdd && (
        <form action={onAdd} className="card mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Client ID</label>
            <input name="clientId" className="input" placeholder="VET-0042" required />
          </div>
          <div>
            <label className="label">Name</label>
            <input name="name" className="input" required />
          </div>
          <div>
            <label className="label">Family Size</label>
            <input
              name="familySize"
              type="number"
              min={1}
              defaultValue={1}
              className="input"
            />
          </div>
          <div>
            <label className="label">Point Budget (blank = auto)</label>
            <input
              name="pointBudget"
              type="number"
              min={0}
              placeholder="auto: 60"
              className="input"
            />
          </div>
          <div className="sm:col-span-2">
            <button className="btn-primary w-full">Save Client</button>
          </div>
        </form>
      )}

      <input
        className="input mt-4"
        placeholder="Search clients…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="mt-4 space-y-2">
        {filtered.length === 0 && (
          <p className="text-sm text-charcoal/50">No clients.</p>
        )}
        {filtered.map((c) => (
          <div key={c.id} className="card">
            {editId === c.id ? (
              <form action={onEdit} className="grid gap-3 sm:grid-cols-2">
                <input type="hidden" name="id" value={c.id} />
                <div>
                  <label className="label">Name</label>
                  <input name="name" defaultValue={c.name} className="input" required />
                </div>
                <div>
                  <label className="label">Family Size</label>
                  <input
                    name="familySize"
                    type="number"
                    min={1}
                    defaultValue={c.familySize}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Point Budget</label>
                  <input
                    name="pointBudget"
                    type="number"
                    min={0}
                    defaultValue={c.pointBudget}
                    className="input"
                  />
                  <p className="mt-1 text-xs text-charcoal/50">
                    Auto for this family size: {defaultBudget(c.familySize)}
                  </p>
                </div>
                <div className="flex items-end gap-2">
                  <button className="btn-primary flex-1">Save</button>
                  <button
                    type="button"
                    onClick={() => setEditId(null)}
                    className="btn-outline"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-navy">
                      {c.name}{" "}
                      {!c.isActive && (
                        <span className="ml-2 rounded bg-charcoal/10 px-2 py-0.5 text-xs text-charcoal/60">
                          inactive
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-charcoal/60">
                      {c.clientId} · Family of {c.familySize} · {c.pointBudget} pts
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => loadHistory(c.id)}
                      className="btn-outline text-sm"
                    >
                      {historyFor === c.id ? "Hide History" : "History"}
                    </button>
                    <button
                      onClick={() => setEditId(c.id)}
                      className="btn-outline text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => toggleActive(c.id, !c.isActive)}
                      className={c.isActive ? "btn-danger text-sm" : "btn-gold text-sm"}
                    >
                      {c.isActive ? "Deactivate" : "Reactivate"}
                    </button>
                  </div>
                </div>
                {historyFor === c.id && (
                  <div className="mt-3 border-t border-black/5 pt-3">
                    {history.length === 0 ? (
                      <p className="text-sm text-charcoal/50">No visits yet.</p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-charcoal/50">
                            <th className="py-1">Date</th>
                            <th className="py-1">Items</th>
                            <th className="py-1">Points</th>
                            <th className="py-1">Volunteer</th>
                          </tr>
                        </thead>
                        <tbody>
                          {history.map((h) => (
                            <tr key={h.transactionId} className="border-t border-black/5">
                              <td className="py-1.5">{h.date}</td>
                              <td className="py-1.5">{h.itemCount}</td>
                              <td className="py-1.5">{h.pointsUsed}</td>
                              <td className="py-1.5">{h.volunteer ?? "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
