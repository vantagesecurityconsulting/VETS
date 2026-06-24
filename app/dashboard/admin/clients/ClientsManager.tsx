"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createClientAction,
  updateClientAction,
  archiveClientAction,
  reactivateClientAction,
  deleteClientAction,
  getClientHistoryAction,
  getFamilyMembersAction,
  addFamilyMemberAction,
  deleteFamilyMemberAction,
  getClientBasketsAction,
  addBasketAction,
  deleteBasketAction,
  type VisitHistoryRow,
  type FamilyMember,
  type HolidayBasket,
} from "./actions";
import { HOLIDAYS } from "@/lib/holidays";

export interface ClientRow {
  id: number;
  clientId: string;
  name: string;
  familySize: number;
  pointBudget: number;
  isActive: boolean;
  archiveReason: string | null;
  memberCount: number;
  dateOfBirth: string | null;
  gender: string | null;
  address: string | null;
  contact: string | null;
  email: string | null;
  serviceNumber: string | null;
  notes: string | null;
  deliveryApproved: boolean;
  hasPortalPin: boolean;
}

/** Shared detail inputs for the head of household (used in add & edit forms). */
function ClientDetailFields({ c }: { c?: ClientRow }) {
  return (
    <>
      <div>
        <label className="label">Date of Birth</label>
        <input name="dob" type="date" defaultValue={c?.dateOfBirth ?? ""} className="input" />
      </div>
      <div>
        <label className="label">Gender</label>
        <input name="gender" defaultValue={c?.gender ?? ""} className="input" />
      </div>
      <div>
        <label className="label">Contact Number</label>
        <input name="contact" defaultValue={c?.contact ?? ""} className="input" />
      </div>
      <div>
        <label className="label">Email</label>
        <input name="email" type="email" defaultValue={c?.email ?? ""} className="input" />
      </div>
      <div>
        <label className="label">Service Number</label>
        <input name="serviceNumber" defaultValue={c?.serviceNumber ?? ""} className="input" />
      </div>
      <div>
        <label className="label">Address</label>
        <input name="address" defaultValue={c?.address ?? ""} className="input" />
      </div>
      <div className="sm:col-span-2">
        <label className="label">Allergies / Important Notes</label>
        <input name="notes" defaultValue={c?.notes ?? ""} className="input" />
      </div>
      <div className="sm:col-span-2">
        <label className="flex items-center gap-2 rounded-lg border border-gold/40 bg-gold/10 px-3 py-2.5">
          <input
            type="checkbox"
            name="deliveryApproved"
            defaultChecked={c?.deliveryApproved}
            className="h-5 w-5"
          />
          <span className="text-sm font-semibold text-navy">
            Approved for delivery
            <span className="block text-xs font-normal text-charcoal/60">
              Lets this client sign in at the delivery portal with their Client
              ID + PIN to shop and submit an order.
            </span>
          </span>
        </label>
      </div>
      <div className="sm:col-span-2">
        <label className="label">
          Delivery portal PIN (4–6 digits)
          {c?.hasPortalPin && (
            <span className="ml-2 text-xs font-normal text-green-700">✓ PIN set</span>
          )}
        </label>
        <input
          name="portalPin"
          type="password"
          inputMode="numeric"
          pattern="\d{4,6}"
          maxLength={6}
          autoComplete="off"
          className="input"
          placeholder={c?.hasPortalPin ? "Leave blank to keep current PIN" : "Set a PIN for portal login"}
        />
        <p className="mt-1 text-xs text-charcoal/50">
          The client signs in to the delivery portal with their Client ID and this PIN.
        </p>
      </div>
    </>
  );
}

function defaultBudget(familySize: number) {
  return 60 + (Math.max(1, familySize) - 1) * 5;
}

/**
 * Family size + credit budget inputs. The budget auto-updates whenever the
 * family size changes (and can still be overridden manually).
 */
function BudgetFields({
  initialSize,
  initialBudget,
}: {
  initialSize: number;
  initialBudget?: number;
}) {
  const [sizeStr, setSizeStr] = useState(String(initialSize));
  const [budgetStr, setBudgetStr] = useState(
    String(initialBudget ?? defaultBudget(initialSize))
  );
  return (
    <>
      <div>
        <label className="label">Number of people in household</label>
        <input
          name="familySize"
          type="number"
          min={1}
          value={sizeStr}
          onChange={(e) => {
            setSizeStr(e.target.value);
            const n = parseInt(e.target.value, 10);
            if (!isNaN(n) && n >= 1) setBudgetStr(String(defaultBudget(n)));
          }}
          className="input"
        />
      </div>
      <div>
        <label className="label">Credits (auto-calculated)</label>
        <input
          name="pointBudget"
          type="number"
          min={0}
          value={budgetStr}
          onChange={(e) => setBudgetStr(e.target.value)}
          className="input"
        />
        <p className="mt-1 text-xs text-charcoal/50">
          60 + 5 per additional member. Auto-updates with household size; edit to
          override.
        </p>
      </div>
    </>
  );
}

export default function ClientsManager({
  clients,
  nextClientId,
}: {
  clients: ClientRow[];
  nextClientId: string;
}) {
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
  const [basketsFor, setBasketsFor] = useState<number | null>(null);
  const [baskets, setBaskets] = useState<HolidayBasket[]>([]);

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

  const hardDelete = (c: ClientRow) => {
    if (
      !confirm(
        `Permanently delete ${c.name} (${c.clientId})? This removes the client and their family members for good. Past visit history is kept but no longer linked. This cannot be undone.`
      )
    )
      return;
    startTransition(async () => {
      await deleteClientAction(c.id);
      router.refresh();
    });
  };

  const loadHistory = async (id: number) => {
    if (historyFor === id) return setHistoryFor(null);
    setFamilyFor(null);
    setBasketsFor(null);
    const rows = await getClientHistoryAction(id);
    setHistory(rows);
    setHistoryFor(id);
  };

  const loadFamily = async (id: number) => {
    if (familyFor === id) return setFamilyFor(null);
    setHistoryFor(null);
    setBasketsFor(null);
    const rows = await getFamilyMembersAction(id);
    setFamily(rows);
    setFamilyFor(id);
  };

  const loadBaskets = async (id: number) => {
    if (basketsFor === id) return setBasketsFor(null);
    setHistoryFor(null);
    setFamilyFor(null);
    const rows = await getClientBasketsAction(id);
    setBaskets(rows);
    setBasketsFor(id);
  };

  const addBasket = async (fd: FormData) => {
    setError("");
    const res = await addBasketAction(fd);
    if (!res.success) return setError(res.error || "Failed.");
    const clientId = Number(fd.get("clientId"));
    setBaskets(await getClientBasketsAction(clientId));
    router.refresh();
  };

  const removeBasket = async (basketId: number, clientId: number) => {
    await deleteBasketAction(basketId);
    setBaskets(await getClientBasketsAction(clientId));
    router.refresh();
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
            <input name="clientId" className="input" defaultValue={nextClientId} required />
            <p className="mt-1 text-xs text-charcoal/50">
              Auto-suggested next number — edit if needed.
            </p>
          </div>
          <div>
            <label className="label">Name (head of household)</label>
            <input name="name" className="input" required />
          </div>
          <BudgetFields initialSize={1} />
          <ClientDetailFields />
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
                <BudgetFields initialSize={c.familySize} initialBudget={c.pointBudget} />
                <ClientDetailFields c={c} />
                <div className="flex items-end gap-2 sm:col-span-2">
                  <button className="btn-primary">Save</button>
                  <button type="button" onClick={() => setEditId(null)} className="btn-outline">
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-navy">
                      {c.name}
                      {c.deliveryApproved && (
                        <span className="ml-2 rounded-full bg-gold/20 px-2 py-0.5 text-xs font-bold text-gold">
                          🚚 Delivery
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-charcoal/60">
                      {c.clientId} · Family of {c.familySize} · {c.pointBudget} credits
                      {c.memberCount > 0 && ` · ${c.memberCount} member${c.memberCount === 1 ? "" : "s"} on file`}
                    </p>
                    {(c.contact || c.email || c.serviceNumber || c.dateOfBirth || c.gender) && (
                      <p className="text-xs text-charcoal/50">
                        {[
                          c.dateOfBirth && `DOB ${c.dateOfBirth}`,
                          c.gender,
                          c.serviceNumber && `SN ${c.serviceNumber}`,
                          c.contact,
                          c.email,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                    {c.address && (
                      <p className="text-xs text-charcoal/50">{c.address}</p>
                    )}
                    {c.notes && (
                      <p className="mt-0.5 text-xs font-semibold text-military">⚠ {c.notes}</p>
                    )}
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
                    <button onClick={() => loadBaskets(c.id)} className="btn-outline text-sm">
                      {basketsFor === c.id ? "Hide Baskets" : "🎁 Baskets"}
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
                    <button
                      onClick={() => hardDelete(c)}
                      className="rounded-lg border border-military/40 px-3 py-1.5 text-sm font-semibold text-military hover:bg-military/5"
                    >
                      Delete
                    </button>
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
                              {(m.address || m.contact || m.email) && (
                                <span className="block text-xs text-charcoal/50">
                                  {[m.contact, m.email, m.address]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </span>
                              )}
                              {m.notes && (
                                <span className="block text-xs font-semibold text-military">
                                  ⚠ {m.notes}
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
                      <input name="name" placeholder="Full name" className="input" />
                      <input name="dob" type="date" className="input" title="Date of birth" />
                      <input name="gender" placeholder="Gender" className="input" />
                      <input name="serviceNumber" placeholder="Service number" className="input" />
                      <input name="contact" placeholder="Contact number" className="input" />
                      <input name="email" type="email" placeholder="Email" className="input" />
                      <input name="address" placeholder="Address" className="input sm:col-span-3" />
                      <input
                        name="notes"
                        placeholder="Allergies / important notes"
                        className="input sm:col-span-3"
                      />
                      <div className="sm:col-span-3">
                        <button className="btn-primary text-sm">+ Add Member</button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Holiday baskets panel */}
                {basketsFor === c.id && (
                  <div className="mt-3 border-t border-black/5 pt-3">
                    <p className="mb-2 text-sm font-semibold text-navy">
                      🎁 Holiday Baskets{" "}
                      <span className="font-normal text-charcoal/50">
                        (Easter, Christmas, Back to School &amp; more)
                      </span>
                    </p>
                    {baskets.length === 0 ? (
                      <p className="text-sm text-charcoal/50">
                        No holiday baskets logged yet.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {baskets.map((b) => (
                          <div
                            key={b.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-offwhite px-3 py-2 text-sm"
                          >
                            <div>
                              <span className="font-medium">
                                {b.holiday} {b.year}
                              </span>
                              <span className="text-charcoal/50">
                                {` · given ${b.givenAt}`}
                                {b.givenBy ? ` · by ${b.givenBy}` : ""}
                              </span>
                              {b.notes && (
                                <span className="block text-xs text-charcoal/50">
                                  {b.notes}
                                </span>
                              )}
                            </div>
                            <button
                              onClick={() => removeBasket(b.id, c.id)}
                              className="rounded px-2 py-1 text-xs font-semibold text-military"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <form action={addBasket} className="mt-3 grid gap-2 sm:grid-cols-4">
                      <input type="hidden" name="clientId" value={c.id} />
                      <select name="holiday" className="input" defaultValue="" required>
                        <option value="" disabled>
                          Holiday…
                        </option>
                        {HOLIDAYS.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                      <input
                        name="year"
                        type="number"
                        className="input"
                        defaultValue={new Date().getFullYear()}
                        title="Year"
                      />
                      <input
                        name="notes"
                        placeholder="Notes (optional)"
                        className="input sm:col-span-2"
                      />
                      <div className="sm:col-span-4">
                        <button className="btn-primary text-sm">+ Log Basket Given</button>
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
