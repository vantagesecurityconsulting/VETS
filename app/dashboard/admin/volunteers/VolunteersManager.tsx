"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createVolunteerAction,
  updateVolunteerAction,
  toggleVolunteerActiveAction,
  getVolunteerActivityAction,
  type ActivityRow,
} from "./actions";

export interface UserRow {
  id: number;
  name: string;
  role: "manager" | "volunteer";
  isActive: boolean;
  createdAt: string;
}

export default function VolunteersManager({ users }: { users: UserRow[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [activityFor, setActivityFor] = useState<number | null>(null);
  const [activity, setActivity] = useState<ActivityRow[]>([]);

  const onAdd = async (fd: FormData) => {
    setError("");
    const res = await createVolunteerAction(fd);
    if (!res.success) return setError(res.error || "Failed.");
    setShowAdd(false);
    router.refresh();
  };

  const onEdit = async (fd: FormData) => {
    setError("");
    const res = await updateVolunteerAction(fd);
    if (!res.success) return setError(res.error || "Failed.");
    setEditId(null);
    router.refresh();
  };

  const toggle = (id: number, active: boolean) => {
    setError("");
    startTransition(async () => {
      const res = await toggleVolunteerActiveAction(id, active);
      if (!res.success) setError(res.error || "Failed.");
      router.refresh();
    });
  };

  const loadActivity = async (id: number) => {
    if (activityFor === id) return setActivityFor(null);
    const rows = await getVolunteerActivityAction(id);
    setActivity(rows);
    setActivityFor(id);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-bold text-navy">Volunteers</h1>
        <button onClick={() => setShowAdd((s) => !s)} className="btn-primary">
          {showAdd ? "Cancel" : "+ Add Account"}
        </button>
      </div>

      {error && (
        <p className="mt-3 rounded-md bg-military/10 px-3 py-2 text-sm font-semibold text-military">
          {error}
        </p>
      )}

      {showAdd && (
        <form action={onAdd} className="card mt-4 grid gap-3 sm:grid-cols-3">
          <div>
            <label className="label">Name</label>
            <input name="name" className="input" required />
          </div>
          <div>
            <label className="label">4-digit PIN</label>
            <input
              name="pin"
              inputMode="numeric"
              pattern="\d{4}"
              maxLength={4}
              className="input text-center tracking-widest"
              required
            />
          </div>
          <div>
            <label className="label">Role</label>
            <select name="role" className="input" defaultValue="volunteer">
              <option value="volunteer">Volunteer</option>
              <option value="manager">Manager</option>
            </select>
          </div>
          <div className="sm:col-span-3">
            <button className="btn-primary w-full">Create Account</button>
          </div>
        </form>
      )}

      <div className="mt-4 space-y-2">
        {users.map((u) => (
          <div key={u.id} className="card">
            {editId === u.id ? (
              <form action={onEdit} className="grid gap-3 sm:grid-cols-3">
                <input type="hidden" name="id" value={u.id} />
                <div>
                  <label className="label">Name</label>
                  <input name="name" defaultValue={u.name} className="input" required />
                </div>
                <div>
                  <label className="label">New PIN (blank = keep)</label>
                  <input
                    name="pin"
                    inputMode="numeric"
                    pattern="\d{4}"
                    maxLength={4}
                    className="input text-center tracking-widest"
                    placeholder="••••"
                  />
                </div>
                <div>
                  <label className="label">Role</label>
                  <select name="role" className="input" defaultValue={u.role}>
                    <option value="volunteer">Volunteer</option>
                    <option value="manager">Manager</option>
                  </select>
                </div>
                <div className="flex items-end gap-2 sm:col-span-3">
                  <button className="btn-primary">Save</button>
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
                      {u.name}
                      <span className="ml-2 rounded bg-navy/10 px-2 py-0.5 text-xs uppercase text-navy">
                        {u.role}
                      </span>
                      {!u.isActive && (
                        <span className="ml-2 rounded bg-charcoal/10 px-2 py-0.5 text-xs text-charcoal/60">
                          inactive
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-charcoal/50">Added {u.createdAt}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => loadActivity(u.id)} className="btn-outline text-sm">
                      {activityFor === u.id ? "Hide Activity" : "Activity"}
                    </button>
                    <button onClick={() => setEditId(u.id)} className="btn-outline text-sm">
                      Edit / Reset PIN
                    </button>
                    <button
                      onClick={() => toggle(u.id, !u.isActive)}
                      className={u.isActive ? "btn-danger text-sm" : "btn-gold text-sm"}
                    >
                      {u.isActive ? "Deactivate" : "Reactivate"}
                    </button>
                  </div>
                </div>
                {activityFor === u.id && (
                  <div className="mt-3 border-t border-black/5 pt-3">
                    {activity.length === 0 ? (
                      <p className="text-sm text-charcoal/50">No activity yet.</p>
                    ) : (
                      <ul className="space-y-1 text-sm">
                        {activity.map((a, i) => (
                          <li key={i} className="flex justify-between border-b border-black/5 py-1">
                            <span>{a.detail}</span>
                            <span className="text-charcoal/50">{a.date}</span>
                          </li>
                        ))}
                      </ul>
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
