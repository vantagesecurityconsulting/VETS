"use server";

import { sql } from "@/lib/db";
import { requireManager, hashPin, isValidPinFormat, verifyPin } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export interface ActionResult {
  success: boolean;
  error?: string;
}

async function pinInUse(pin: string, excludeId?: number): Promise<boolean> {
  const { rows } = await sql`SELECT id, pin FROM users WHERE is_active = true;`;
  for (const u of rows) {
    if (excludeId && u.id === excludeId) continue;
    if (await verifyPin(pin, u.pin)) return true;
  }
  return false;
}

export async function createVolunteerAction(
  formData: FormData
): Promise<ActionResult> {
  await requireManager();
  const name = String(formData.get("name") || "").trim();
  const pin = String(formData.get("pin") || "").trim();
  const role = String(formData.get("role") || "volunteer");

  if (!name) return { success: false, error: "Name is required." };
  if (!isValidPinFormat(pin)) return { success: false, error: "PIN must be 4 digits." };
  if (await pinInUse(pin)) return { success: false, error: "That PIN is already in use." };

  const hashed = await hashPin(pin);
  await sql`
    INSERT INTO users (name, pin, role, must_change_pin, is_active)
    VALUES (${name}, ${hashed}, ${role === "manager" ? "manager" : "volunteer"}, false, true);
  `;
  revalidatePath("/dashboard/admin/volunteers");
  return { success: true };
}

export async function updateVolunteerAction(
  formData: FormData
): Promise<ActionResult> {
  await requireManager();
  const id = Number(formData.get("id"));
  const name = String(formData.get("name") || "").trim();
  const role = String(formData.get("role") || "volunteer");
  const pin = String(formData.get("pin") || "").trim();

  if (!id || !name) return { success: false, error: "Name is required." };

  await sql`
    UPDATE users
    SET name = ${name}, role = ${role === "manager" ? "manager" : "volunteer"}
    WHERE id = ${id};
  `;

  if (pin) {
    if (!isValidPinFormat(pin)) return { success: false, error: "PIN must be 4 digits." };
    if (await pinInUse(pin, id)) return { success: false, error: "That PIN is already in use." };
    const hashed = await hashPin(pin);
    await sql`UPDATE users SET pin = ${hashed}, must_change_pin = false WHERE id = ${id};`;
  }

  revalidatePath("/dashboard/admin/volunteers");
  return { success: true };
}

export async function toggleVolunteerActiveAction(
  id: number,
  isActive: boolean
): Promise<ActionResult> {
  const session = await requireManager();
  if (id === session.userId && !isActive) {
    return { success: false, error: "You can't deactivate your own account." };
  }
  await sql`UPDATE users SET is_active = ${isActive} WHERE id = ${id};`;
  revalidatePath("/dashboard/admin/volunteers");
  return { success: true };
}

export interface ActivityRow {
  type: string;
  date: string;
  detail: string;
}

export async function getVolunteerActivityAction(
  id: number
): Promise<ActivityRow[]> {
  await requireManager();
  const { rows } = await sql`
    SELECT
      t.type,
      t.created_at,
      COALESCE(SUM(ti.quantity), 0)::int AS item_count
    FROM transactions t
    LEFT JOIN transaction_items ti ON ti.transaction_id = t.id
    WHERE t.volunteer_id = ${id}
    GROUP BY t.id, t.type, t.created_at
    ORDER BY t.created_at DESC
    LIMIT 50;
  `;
  const labels: Record<string, string> = {
    stock_out: "Client visit",
    stock_in: "Donation logged",
    audit: "Stock count",
  };
  return rows.map((r) => ({
    type: r.type,
    date: new Date(r.created_at).toLocaleString(),
    detail: `${labels[r.type] ?? r.type} · ${r.item_count} items`,
  }));
}
