"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createClientAction,
  updateClientAction,
  archiveClientAction,
  reactivateClientAction,
  getClientHistoryAction,
  getFamilyMembersAction,
  addFamilyMemberAction,
  deleteFamilyMemberAction,
  type VisitHistoryRow,
  type FamilyMember,
} from "./actions";

export interface ClientRow {
  id: number;
  clientId: string;
  name: string;
  familySize: number;
  pointBudget: number;
  isActive: boolean;
  archiveReason: string | null;
  memberCount: number;
}

function defaultBudget(familySize: number) {
  return 60 + (Math.max(1, familySize) - 1) * 5;
}

export default function ClientsManager({ clients }: { clients: ClientRow[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [tab, setTab] = useState<"active" | "archived">("active");
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const [historyFor, setHistoryFor] = useState<number | null>(null);
  const [history, setHistory] = useState<VisitHistoryRow[]>([]);
  const [familyFor, setFamilyFor] = useState<number | null>(null);
  const [family, setFamily] = useState<FamilyMember[]>([]);

  const list = clients.filter((c) => (tab === "active" ? c.isActive : !c.isActive));
  const filtered = list.filter(
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

  const archive = (id: number) => {
    const reason = window.prompt(
      "Reason for archiving this client? (e.g. moved, no longer needs services)"
    );
    if (reason === null) return; // cancelled
    startTransition(async () => {
      await archiveClientAction(id, reason);
      router.refresh();
    });
  };

  const reactivate = (id: number) => {
    startTransition(async () => {
      await reactivateClientAction(id);
      router.refresh();
    });
  };

  const loadHistory = async (id: number) => {
    if (historyFor === id) return setHistoryFor(null);
    setFamilyFor(null);
    const rows = await getClientHistoryAction(id);
    setHistory(rows);
    setHistoryFor(id);
  };

  const loadFamily = async (id: number) => {
    if (familyFor === id) return setFamilyFor(null);
    setHistoryFor(null);
    const rows = await getFamilyMembersAction(id);
    setFamily(rows);
    setFamilyFor(id);
  };

  const addMember = async (fd: FormData) => {
    setError("");
    const res = await addFamilyMemberAction(fd);
    if (!res.success) return setError(res.error || "Failed.");
    const clientId = Number(fd.get("clientId"));
    setFamily(await getFamilyMembersAction(clientId));
    router.refresh();
  };

  const removeMember = async (memberId: number, clientId: number) => {
    await deleteFamilyMemberAction(memberId);
    setFamily(await getFamilyMembersAction(clientId));
    router.refresh();
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-bold text-navy">Clients</h1>
        <button onClick={() => setShowAdd((s) => !s)} className="btn-primary">
          {showAdd ? "Cancel" : "+ Add Client"}
        </button>
      </div>

      {/* Active / Archived tabs */}
      <div className="mt-4 flex gap-2">
        {(["active", "archived"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-1.5 text-sm font-semibold capitalize transition ${
              tab === t ? "bg-navy text-white" : "bg-white text-navy hover:bg-navy/10"
            }`}
          >
            {t} ({clients.filter((c) => (t === "active" ? c.isActive : !c.isActive)).length})
          </button>
        ))}
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
            <label className="label">Name (head of household)</label>
            <input name="name" className="input" required />
          </div>
          <div>
            <label className="label">Family Size</label>
            <input name="familySize" type="number" min={1} defaultValue={1} className="input" />
          </div>
          <div>
            <label className="label">Point Budget (blank = auto)</label>
            <input name="pointBudget" type="number" min={0} placeholder="auto: 60" className="input" />
          </div>
          <div className="sm:col-span-2">
            <button className="btn-primary w-full">Save Client</button>
            <p className="mt-1 text-xs text-charcoal/50">
              Credits auto-calculate as 60 + 5 per extra family member. You can
              add individual family member details after saving.
            </p>
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
          <p className="text-sm text-charcoal/50">No {tab} clients.</p>
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
                  <input name="familySize" type="number" min={1} defaultValue={c.familySize} className="input" />
                </div>
                <div>
                  <label className="label">Point Budget</label>
                  <input name="pointBudget" type="number" min={0} defaultValue={c.pointBudget} className="input" />
                  <p className="mt-1 text-xs text-charcoal/50">
                    Auto for this family size: {defaultBudget(c.familySize)}
                  </p>
                </div>
                <div className="flex items-end gap-2">
                  <button className="btn-primary flex-1">Save</button>
                  <button type="button" onClick={() => setEditId(null)} className="btn-outline">
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-navy">{c.name}</p>
                    <p className="text-sm text-charcoal/60">
                      {c.clientId} · Family of {c.familySize} · {c.pointBudget} credits
                      {c.memberCount > 0 && ` · ${c.memberCount} member${c.memberCount === 1 ? "" : "s"} on file`}
                    </p>
                    {!c.isActive && c.archiveReason && (
                      <p className="mt-1 text-xs italic text-charcoal/50">
                        Archived: {c.archiveReason}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => loadFamily(c.id)} className="btn-outline text-sm">
                      {familyFor === c.id ? "Hide Family" : "Family"}
                    </button>
                    <button onClick={() => loadHistory(c.id)} className="btn-outline text-sm">
                      {historyFor === c.id ? "Hide History" : "History"}
                    </button>
                    <button onClick={() => setEditId(c.id)} className="btn-outline text-sm">
                      Edit
                    </button>
                    {c.isActive ? (
                      <button onClick={() => archive(c.id)} className="btn-danger text-sm">
                        Archive
                      </button>
                    ) : (
                      <button onClick={() => reactivate(c.id)} className="btn-gold text-sm">
                        Reactivate
                      </button>
                    )}
                  </div>
                </div>

                {/* Family members panel */}
                {familyFor === c.id && (
                  <div className="mt-3 border-t border-black/5 pt-3">
                    <p className="mb-2 text-sm font-semibold text-navy">
                      Family Members <span className="font-normal text-charcoal/50">(all fields optional)</span>
                    </p>
                    {family.length === 0 ? (
                      <p className="text-sm text-charcoal/50">No members added yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {family.map((m) => (
                          <div
                            key={m.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-offwhite px-3 py-2 text-sm"
                          >
                            <div>
                              <span className="font-medium">{m.name || "(no name)"}</span>
                              <span className="text-charcoal/50">
                                {m.dateOfBirth ? ` · DOB ${m.dateOfBirth}` : ""}
                                {m.gender ? ` · ${m.gender}` : ""}
                                {m.serviceNumber ? ` · SN ${m.serviceNumber}` : ""}
                              </span>
                              {(m.address || m.contact) && (
                                <span className="block text-xs text-charcoal/50">
                                  {[m.address, m.contact].filter(Boolean).join(" · ")}
                                </span>
                              )}
                            </div>
                            <button
                              onClick={() => removeMember(m.id, c.id)}
                              className="rounded px-2 py-1 text-xs font-semibold text-military"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <form action={addMember} className="mt-3 grid gap-2 sm:grid-cols-3">
                      <input type="hidden" name="clientId" value={c.id} />
                      <input name="name" placeholder="Name" className="input" />
                      <input name="dob" type="date" className="input" title="Date of birth" />
                      <input name="gender" placeholder="Gender" className="input" />
                      <input name="serviceNumber" placeholder="Service number" className="input" />
                      <input name="contact" placeholder="Contact info" className="input" />
                      <input name="address" placeholder="Address" className="input" />
                      <div className="sm:col-span-3">
                        <button className="btn-primary text-sm">+ Add Member</button>
                      </div>
                    </form>
                  </div>
                )}

                {/* History panel */}
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
                            <th className="py-1">Credits</th>
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
