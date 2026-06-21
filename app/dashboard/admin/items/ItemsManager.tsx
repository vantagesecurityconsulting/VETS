"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createCategoryAction,
  updateCategoryAction,
  createItemAction,
  updateItemAction,
  toggleItemActiveAction,
  moveCategoryAction,
  moveItemAction,
  resetCatalogAction,
} from "./actions";

export interface AdminItem {
  id: number;
  name: string;
  isActive: boolean;
}
export interface AdminCategory {
  id: number;
  name: string;
  pointValue: number;
  items: AdminItem[];
}

export default function ItemsManager({
  categories,
}: {
  categories: AdminCategory[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [openCat, setOpenCat] = useState<number | null>(null);
  const [editCat, setEditCat] = useState<number | null>(null);
  const [editItem, setEditItem] = useState<number | null>(null);
  const [showAddCat, setShowAddCat] = useState(false);

  const refresh = () => router.refresh();
  const run = (fn: () => Promise<{ success: boolean; error?: string }>) => {
    setError("");
    startTransition(async () => {
      const res = await fn();
      if (!res.success) setError(res.error || "Action failed.");
      refresh();
    });
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-bold text-navy">
          Items & Categories
        </h1>
        <div className="flex gap-2">
          <button
            onClick={() => {
              if (
                confirm(
                  "Reset the catalog to the default food-bank list? This clears all current items, stock levels, and donation/count history. Clients and volunteer accounts are NOT affected."
                )
              ) {
                run(() => resetCatalogAction());
              }
            }}
            className="btn-outline"
          >
            Reset to Default List
          </button>
          <button onClick={() => setShowAddCat((s) => !s)} className="btn-primary">
            {showAddCat ? "Cancel" : "+ Add Category"}
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-3 rounded-md bg-military/10 px-3 py-2 text-sm font-semibold text-military">
          {error}
        </p>
      )}

      {showAddCat && (
        <form
          action={async (fd) => {
            setError("");
            const res = await createCategoryAction(fd);
            if (!res.success) return setError(res.error || "Failed.");
            setShowAddCat(false);
            refresh();
          }}
          className="card mt-4 grid gap-3 sm:grid-cols-3"
        >
          <div className="sm:col-span-2">
            <label className="label">Category Name</label>
            <input name="name" className="input" required />
          </div>
          <div>
            <label className="label">Point Value</label>
            <input name="pointValue" type="number" min={0} defaultValue={1} className="input" />
          </div>
          <div className="sm:col-span-3">
            <button className="btn-primary w-full">Add Category</button>
          </div>
        </form>
      )}

      <div className="mt-4 space-y-2">
        {categories.map((cat, ci) => (
          <div key={cat.id} className="card">
            <div className="flex flex-wrap items-center justify-between gap-2">
              {editCat === cat.id ? (
                <form
                  action={async (fd) => {
                    setError("");
                    const res = await updateCategoryAction(fd);
                    if (!res.success) return setError(res.error || "Failed.");
                    setEditCat(null);
                    refresh();
                  }}
                  className="flex flex-1 flex-wrap items-end gap-2"
                >
                  <input type="hidden" name="id" value={cat.id} />
                  <div className="flex-1">
                    <label className="label">Name</label>
                    <input name="name" defaultValue={cat.name} className="input" required />
                  </div>
                  <div className="w-24">
                    <label className="label">Points</label>
                    <input
                      name="pointValue"
                      type="number"
                      min={0}
                      defaultValue={cat.pointValue}
                      className="input"
                    />
                  </div>
                  <button className="btn-primary">Save</button>
                  <button type="button" onClick={() => setEditCat(null)} className="btn-outline">
                    Cancel
                  </button>
                </form>
              ) : (
                <>
                  <button
                    onClick={() => setOpenCat(openCat === cat.id ? null : cat.id)}
                    className="flex items-center gap-2 text-left"
                  >
                    <span className="font-heading text-lg font-bold text-navy">
                      {cat.name}
                    </span>
                    <span className="rounded-full bg-gold/15 px-2 py-0.5 text-xs font-bold text-gold">
                      {cat.pointValue} pt{cat.pointValue === 1 ? "" : "s"}
                    </span>
                    <span className="text-xs text-charcoal/40">
                      ({cat.items.length} items)
                    </span>
                  </button>
                  <div className="flex gap-1">
                    <button
                      onClick={() => run(() => moveCategoryAction(cat.id, -1))}
                      disabled={ci === 0}
                      className="btn-outline px-2 py-1 text-sm disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => run(() => moveCategoryAction(cat.id, 1))}
                      disabled={ci === categories.length - 1}
                      className="btn-outline px-2 py-1 text-sm disabled:opacity-30"
                    >
                      ↓
                    </button>
                    <button onClick={() => setEditCat(cat.id)} className="btn-outline px-2 py-1 text-sm">
                      Edit
                    </button>
                  </div>
                </>
              )}
            </div>

            {openCat === cat.id && (
              <div className="mt-3 border-t border-black/5 pt-3">
                <div className="space-y-1.5">
                  {cat.items.map((it, ii) => (
                    <div
                      key={it.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-offwhite px-2 py-1.5"
                    >
                      {editItem === it.id ? (
                        <form
                          action={async (fd) => {
                            setError("");
                            const res = await updateItemAction(fd);
                            if (!res.success) return setError(res.error || "Failed.");
                            setEditItem(null);
                            refresh();
                          }}
                          className="flex flex-1 items-center gap-2"
                        >
                          <input type="hidden" name="id" value={it.id} />
                          <input name="name" defaultValue={it.name} className="input flex-1" required />
                          <button className="btn-primary px-3 py-1.5 text-sm">Save</button>
                          <button
                            type="button"
                            onClick={() => setEditItem(null)}
                            className="btn-outline px-3 py-1.5 text-sm"
                          >
                            Cancel
                          </button>
                        </form>
                      ) : (
                        <>
                          <span
                            className={`text-sm ${
                              it.isActive ? "text-charcoal" : "text-charcoal/40 line-through"
                            }`}
                          >
                            {it.name}
                          </span>
                          <div className="flex gap-1">
                            <button
                              onClick={() => run(() => moveItemAction(it.id, cat.id, -1))}
                              disabled={ii === 0}
                              className="rounded border border-navy/20 px-2 text-sm disabled:opacity-30"
                            >
                              ↑
                            </button>
                            <button
                              onClick={() => run(() => moveItemAction(it.id, cat.id, 1))}
                              disabled={ii === cat.items.length - 1}
                              className="rounded border border-navy/20 px-2 text-sm disabled:opacity-30"
                            >
                              ↓
                            </button>
                            <button
                              onClick={() => setEditItem(it.id)}
                              className="rounded border border-navy/20 px-2 py-1 text-xs font-semibold text-navy"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => run(() => toggleItemActiveAction(it.id, !it.isActive))}
                              className={`rounded px-2 py-1 text-xs font-semibold ${
                                it.isActive
                                  ? "bg-military/10 text-military"
                                  : "bg-gold/15 text-gold"
                              }`}
                            >
                              {it.isActive ? "Disable" : "Enable"}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>

                <form
                  action={async (fd) => {
                    setError("");
                    const res = await createItemAction(fd);
                    if (!res.success) return setError(res.error || "Failed.");
                    refresh();
                  }}
                  className="mt-3 flex items-center gap-2"
                >
                  <input type="hidden" name="categoryId" value={cat.id} />
                  <input name="name" placeholder="New item name…" className="input flex-1" required />
                  <button className="btn-primary px-3 py-2 text-sm">+ Add Item</button>
                </form>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
