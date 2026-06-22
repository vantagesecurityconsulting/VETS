"use server";

import { sql } from "@/lib/db";
import { requireManager } from "@/lib/auth";
import { defaultPointBudget } from "@/lib/points";
import { revalidatePath } from "next/cache";

export interface ActionResult {
  success: boolean;
  error?: string;
}

export async function createClientAction(
  formData: FormData
): Promise<ActionResult> {
  await requireManager();
  const clientId = String(formData.get("clientId") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const familySize = Math.max(1, Number(formData.get("familySize")) || 1);
  const budgetRaw = String(formData.get("pointBudget") || "").trim();
  const pointBudget =
    budgetRaw === "" ? defaultPointBudget(familySize) : Number(budgetRaw);

  if (!clientId || !name) {
    return { success: false, error: "Client ID and name are required." };
  }

  const { rows } = await sql`SELECT id FROM clients WHERE client_id = ${clientId};`;
  if (rows.length > 0) {
    return { success: false, error: "That Client ID already exists." };
  }

  await sql`
    INSERT INTO clients (client_id, name, family_size, point_budget, is_active)
    VALUES (${clientId}, ${name}, ${familySize}, ${pointBudget}, true);
  `;
  revalidatePath("/dashboard/admin/clients");
  return { success: true };
}

export async function updateClientAction(
  formData: FormData
): Promise<ActionResult> {
  await requireManager();
  const id = Number(formData.get("id"));
  const name = String(formData.get("name") || "").trim();
  const familySize = Math.max(1, Number(formData.get("familySize")) || 1);
  const pointBudget = Number(formData.get("pointBudget"));

  if (!id || !name) {
    return { success: false, error: "Name is required." };
  }

  await sql`
    UPDATE clients
    SET name = ${name}, family_size = ${familySize}, point_budget = ${pointBudget}
    WHERE id = ${id};
  `;
  revalidatePath("/dashboard/admin/clients");
  return { success: true };
}

export async function archiveClientAction(
  id: number,
  reason: string
): Promise<ActionResult> {
  await requireManager();
  await sql`
    UPDATE clients
    SET is_active = false, archive_reason = ${reason || null}, archived_at = now()
    WHERE id = ${id};
  `;
  revalidatePath("/dashboard/admin/clients");
  return { success: true };
}

export async function reactivateClientAction(id: number): Promise<ActionResult> {
  await requireManager();
  await sql`
    UPDATE clients
    SET is_active = true, archive_reason = NULL, archived_at = NULL
    WHERE id = ${id};
  `;
  revalidatePath("/dashboard/admin/clients");
  return { success: true };
}

// ----------------------------- Family members -----------------------------

export interface FamilyMember {
  id: number;
  name: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  address: string | null;
  contact: string | null;
  email: string | null;
  serviceNumber: string | null;
  notes: string | null;
}

export async function getFamilyMembersAction(
  clientId: number
): Promise<FamilyMember[]> {
  await requireManager();
  const { rows } = await sql`
    SELECT id, name, date_of_birth, gender, address, contact, email, service_number, notes
    FROM family_members WHERE client_id = ${clientId} ORDER BY id;
  `;
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    dateOfBirth: r.date_of_birth ? String(r.date_of_birth) : null,
    gender: r.gender,
    address: r.address,
    contact: r.contact,
    email: r.email,
    serviceNumber: r.service_number,
    notes: r.notes,
  }));
}

export async function addFamilyMemberAction(
  formData: FormData
): Promise<ActionResult> {
  await requireManager();
  const clientId = Number(formData.get("clientId"));
  if (!clientId) return { success: false, error: "Missing client." };
  const get = (k: string) => {
    const v = String(formData.get(k) || "").trim();
    return v === "" ? null : v;
  };
  await sql`
    INSERT INTO family_members
      (client_id, name, date_of_birth, gender, address, contact, email, service_number, notes)
    VALUES (
      ${clientId}, ${get("name")}, ${get("dob")}::date, ${get("gender")},
      ${get("address")}, ${get("contact")}, ${get("email")},
      ${get("serviceNumber")}, ${get("notes")}
    );
  `;
  revalidatePath("/dashboard/admin/clients");
  return { success: true };
}

export async function deleteFamilyMemberAction(
  id: number
): Promise<ActionResult> {
  await requireManager();
  await sql`DELETE FROM family_members WHERE id = ${id};`;
  revalidatePath("/dashboard/admin/clients");
  return { success: true };
}

export interface VisitHistoryRow {
  transactionId: number;
  date: string;
  itemCount: number;
  pointsUsed: number;
  volunteer: string | null;
}

export async function getClientHistoryAction(
  clientId: number
): Promise<VisitHistoryRow[]> {
  await requireManager();
  const { rows } = await sql`
    SELECT
      t.id AS transaction_id,
      t.created_at,
      u.name AS volunteer,
      COALESCE(SUM(ti.quantity), 0)::int AS item_count,
      COALESCE(SUM(ti.quantity * ti.point_value_at_time), 0)::int AS points_used
    FROM transactions t
    LEFT JOIN transaction_items ti ON ti.transaction_id = t.id
    LEFT JOIN users u ON u.id = t.volunteer_id
    WHERE t.type = 'stock_out' AND t.client_id = ${clientId}
    GROUP BY t.id, t.created_at, u.name
    ORDER BY t.created_at DESC
    LIMIT 50;
  `;
  return rows.map((r) => ({
    transactionId: r.transaction_id,
    date: new Date(r.created_at).toLocaleString(),
    itemCount: r.item_count,
    pointsUsed: r.points_used,
    volunteer: r.volunteer,
  }));
}
