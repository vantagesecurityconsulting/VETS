"use server";

import { sql } from "@/lib/db";
import { requireManager } from "@/lib/auth";
import { resetCatalog } from "@/lib/init";
import { revalidatePath } from "next/cache";

export interface ActionResult {
  success: boolean;
  error?: string;
}

const PATH = "/dashboard/admin/items";

/**
 * Wipe the catalog and stock/transaction history and reload the default
 * food-bank basics. Manager only. Does not affect users or clients.
 */
export async function resetCatalogAction(): Promise<ActionResult> {
  await requireManager();
  await resetCatalog();
  revalidatePath(PATH);
  revalidatePath("/dashboard/admin/inventory");
  return { success: true };
}

export async function createCategoryAction(
  formData: FormData
): Promise<ActionResult> {
  await requireManager();
  const name = String(formData.get("name") || "").trim();
  const pointValue = Math.max(0, Number(formData.get("pointValue")) || 0);
  if (!name) return { success: false, error: "Category name is required." };

  const { rows } = await sql`SELECT COALESCE(MAX(display_order), 0) + 1 AS next FROM categories;`;
  await sql`
    INSERT INTO categories (name, point_value, display_order)
    VALUES (${name}, ${pointValue}, ${rows[0].next});
  `;
  revalidatePath(PATH);
  return { success: true };
}

export async function updateCategoryAction(
  formData: FormData
): Promise<ActionResult> {
  await requireManager();
  const id = Number(formData.get("id"));
  const name = String(formData.get("name") || "").trim();
  const pointValue = Math.max(0, Number(formData.get("pointValue")) || 0);
  if (!id || !name) return { success: false, error: "Name is required." };
  await sql`UPDATE categories SET name = ${name}, point_value = ${pointValue} WHERE id = ${id};`;
  revalidatePath(PATH);
  return { success: true };
}

export async function createItemAction(
  formData: FormData
): Promise<ActionResult> {
  await requireManager();
  const categoryId = Number(formData.get("categoryId"));
  const name = String(formData.get("name") || "").trim();
  const unitPrice = Math.max(0, Number(formData.get("unitPrice")) || 0);
  const unitWeight = Math.max(0, Number(formData.get("unitWeight")) || 0);
  if (!categoryId || !name) return { success: false, error: "Item name is required." };

  const { rows } = await sql`
    SELECT COALESCE(MAX(display_order), 0) + 1 AS next FROM items WHERE category_id = ${categoryId};
  `;
  const { rows: itemRows } = await sql`
    INSERT INTO items (category_id, name, unit_price, unit_weight, display_order, is_active)
    VALUES (${categoryId}, ${name}, ${unitPrice}, ${unitWeight}, ${rows[0].next}, true)
    RETURNING id;
  `;
  await sql`INSERT INTO inventory (item_id, quantity) VALUES (${itemRows[0].id}, 0);`;
  revalidatePath(PATH);
  return { success: true };
}

export async function updateItemAction(
  formData: FormData
): Promise<ActionResult> {
  await requireManager();
  const id = Number(formData.get("id"));
  const name = String(formData.get("name") || "").trim();
  const unitPrice = Math.max(0, Number(formData.get("unitPrice")) || 0);
  const unitWeight = Math.max(0, Number(formData.get("unitWeight")) || 0);
  if (!id || !name) return { success: false, error: "Name is required." };
  await sql`UPDATE items SET name = ${name}, unit_price = ${unitPrice}, unit_weight = ${unitWeight} WHERE id = ${id};`;
  revalidatePath(PATH);
  return { success: true };
}

export async function toggleItemActiveAction(
  id: number,
  isActive: boolean
): Promise<ActionResult> {
  await requireManager();
  await sql`UPDATE items SET is_active = ${isActive} WHERE id = ${id};`;
  revalidatePath(PATH);
  return { success: true };
}

/** Swap display_order with the adjacent category (direction: -1 up, +1 down). */
export async function moveCategoryAction(
  id: number,
  direction: -1 | 1
): Promise<ActionResult> {
  await requireManager();
  const { rows } = await sql`SELECT id, display_order FROM categories ORDER BY display_order, name;`;
  const idx = rows.findIndex((r) => r.id === id);
  const swapIdx = idx + direction;
  if (idx < 0 || swapIdx < 0 || swapIdx >= rows.length) return { success: true };
  const a = rows[idx];
  const b = rows[swapIdx];
  await sql`UPDATE categories SET display_order = ${b.display_order} WHERE id = ${a.id};`;
  await sql`UPDATE categories SET display_order = ${a.display_order} WHERE id = ${b.id};`;
  revalidatePath(PATH);
  return { success: true };
}

/** Swap display_order with the adjacent item within the same category. */
export async function moveItemAction(
  id: number,
  categoryId: number,
  direction: -1 | 1
): Promise<ActionResult> {
  await requireManager();
  const { rows } = await sql`
    SELECT id, display_order FROM items WHERE category_id = ${categoryId} ORDER BY display_order, name;
  `;
  const idx = rows.findIndex((r) => r.id === id);
  const swapIdx = idx + direction;
  if (idx < 0 || swapIdx < 0 || swapIdx >= rows.length) return { success: true };
  const a = rows[idx];
  const b = rows[swapIdx];
  await sql`UPDATE items SET display_order = ${b.display_order} WHERE id = ${a.id};`;
  await sql`UPDATE items SET display_order = ${a.display_order} WHERE id = ${b.id};`;
  revalidatePath(PATH);
  return { success: true };
}
