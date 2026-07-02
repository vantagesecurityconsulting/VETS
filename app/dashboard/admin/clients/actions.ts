"use server";

import { sql } from "@/lib/db";
import { requirePermission, hashPin } from "@/lib/auth";
import { defaultPointBudget } from "@/lib/points";
import { revalidatePath } from "next/cache";

function portalPinRaw(formData: FormData): string {
  return String(formData.get("portalPin") || "").trim();
}

export interface ActionResult {
  success: boolean;
  error?: string;
}

function detailFields(formData: FormData) {
  const get = (k: string) => {
    const v = String(formData.get(k) || "").trim();
    return v === "" ? null : v;
  };
  return {
    dob: get("dob"),
    gender: get("gender"),
    address: get("address"),
    contact: get("contact"),
    email: get("email"),
    serviceNumber: get("serviceNumber"),
    notes: get("notes"),
    hasAllergy:
      formData.get("hasAllergy") === "on" ||
      formData.get("hasAllergy") === "true",
    allergyInfo: get("allergyInfo"),
    codeOfConduct:
      formData.get("codeOfConduct") === "on" ||
      formData.get("codeOfConduct") === "true",
    termsOfService:
      formData.get("termsOfService") === "on" ||
      formData.get("termsOfService") === "true",
    deliveryApproved:
      formData.get("deliveryApproved") === "on" ||
      formData.get("deliveryApproved") === "true",
  };
}

export async function createClientAction(
  formData: FormData
): Promise<ActionResult> {
  await requirePermission("clients");
  const clientId = String(formData.get("clientId") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const familySize = Math.max(1, Number(formData.get("familySize")) || 1);
  const budgetRaw = String(formData.get("pointBudget") || "").trim();
  const pointBudget =
    budgetRaw === "" ? defaultPointBudget(familySize) : Number(budgetRaw);
  const d = detailFields(formData);

  if (!clientId || !name) {
    return { success: false, error: "Client ID and name are required." };
  }

  const { rows } = await sql`SELECT id FROM clients WHERE client_id = ${clientId};`;
  if (rows.length > 0) {
    return { success: false, error: "That Client ID already exists." };
  }

  const pinRaw = portalPinRaw(formData);
  if (pinRaw && !/^\d{4,6}$/.test(pinRaw)) {
    return { success: false, error: "Portal PIN must be 4–6 digits." };
  }
  const portalPin = pinRaw ? await hashPin(pinRaw) : null;

  await sql`
    INSERT INTO clients
      (client_id, name, family_size, point_budget, date_of_birth, gender,
       address, contact, email, service_number, notes, has_allergy, allergy_info,
       code_of_conduct, terms_of_service, delivery_approved, portal_pin, is_active)
    VALUES (
      ${clientId}, ${name}, ${familySize}, ${pointBudget}, ${d.dob}::date,
      ${d.gender}, ${d.address}, ${d.contact}, ${d.email}, ${d.serviceNumber},
      ${d.notes}, ${d.hasAllergy}, ${d.allergyInfo},
      ${d.codeOfConduct}, ${d.termsOfService}, ${d.deliveryApproved}, ${portalPin}, true
    );
  `;
  revalidatePath("/dashboard/admin/clients");
  return { success: true };
}

export async function updateClientAction(
  formData: FormData
): Promise<ActionResult> {
  await requirePermission("clients");
  const id = Number(formData.get("id"));
  const name = String(formData.get("name") || "").trim();
  const familySize = Math.max(1, Number(formData.get("familySize")) || 1);
  const pointBudget = Number(formData.get("pointBudget"));
  const d = detailFields(formData);

  if (!id || !name) {
    return { success: false, error: "Name is required." };
  }

  await sql`
    UPDATE clients
    SET name = ${name}, family_size = ${familySize}, point_budget = ${pointBudget},
        date_of_birth = ${d.dob}::date, gender = ${d.gender}, address = ${d.address},
        contact = ${d.contact}, email = ${d.email}, service_number = ${d.serviceNumber},
        notes = ${d.notes}, has_allergy = ${d.hasAllergy}, allergy_info = ${d.allergyInfo},
        code_of_conduct = ${d.codeOfConduct}, terms_of_service = ${d.termsOfService},
        delivery_approved = ${d.deliveryApproved}
    WHERE id = ${id};
  `;

  // Update the portal PIN only when a new one is entered (blank keeps existing).
  const pinRaw = portalPinRaw(formData);
  if (pinRaw) {
    if (!/^\d{4,6}$/.test(pinRaw)) {
      return { success: false, error: "Portal PIN must be 4–6 digits." };
    }
    const hashed = await hashPin(pinRaw);
    await sql`UPDATE clients SET portal_pin = ${hashed} WHERE id = ${id};`;
  }

  revalidatePath("/dashboard/admin/clients");
  return { success: true };
}

export async function deleteClientAction(id: number): Promise<ActionResult> {
  await requirePermission("clients");
  // Cascades to family_members and orders; transaction history is kept
  // (client_id is set NULL there).
  await sql`DELETE FROM clients WHERE id = ${id};`;
  revalidatePath("/dashboard/admin/clients");
  return { success: true };
}

export async function archiveClientAction(
  id: number,
  reason: string
): Promise<ActionResult> {
  await requirePermission("clients");
  await sql`
    UPDATE clients
    SET is_active = false, archive_reason = ${reason || null}, archived_at = now()
    WHERE id = ${id};
  `;
  revalidatePath("/dashboard/admin/clients");
  return { success: true };
}

export async function reactivateClientAction(id: number): Promise<ActionResult> {
  await requirePermission("clients");
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
  await requirePermission("clients");
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
  await requirePermission("clients");
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
  await requirePermission("clients");
  await sql`DELETE FROM family_members WHERE id = ${id};`;
  revalidatePath("/dashboard/admin/clients");
  return { success: true };
}

// -------------------------- Authorized pickups ---------------------------

export interface AuthorizedPickup {
  id: number;
  name: string;
  relationship: string | null;
  contact: string | null;
  notes: string | null;
}

export async function getPickupsAction(
  clientId: number
): Promise<AuthorizedPickup[]> {
  await requirePermission("clients");
  const { rows } = await sql`
    SELECT id, name, relationship, contact, notes
    FROM authorized_pickups WHERE client_id = ${clientId} ORDER BY id;
  `;
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    relationship: r.relationship,
    contact: r.contact,
    notes: r.notes,
  }));
}

export async function addPickupAction(
  formData: FormData
): Promise<ActionResult> {
  await requirePermission("clients");
  const clientId = Number(formData.get("clientId"));
  if (!clientId) return { success: false, error: "Missing client." };
  const get = (k: string) => {
    const v = String(formData.get(k) || "").trim();
    return v === "" ? null : v;
  };
  const name = get("name");
  if (!name) return { success: false, error: "Name is required." };
  await sql`
    INSERT INTO authorized_pickups (client_id, name, relationship, contact, notes)
    VALUES (${clientId}, ${name}, ${get("relationship")}, ${get("contact")}, ${get("notes")});
  `;
  revalidatePath("/dashboard/admin/clients");
  return { success: true };
}

export async function deletePickupAction(id: number): Promise<ActionResult> {
  await requirePermission("clients");
  await sql`DELETE FROM authorized_pickups WHERE id = ${id};`;
  revalidatePath("/dashboard/admin/clients");
  return { success: true };
}

// ----------------------------- Holiday baskets -----------------------------

export interface HolidayBasket {
  id: number;
  clientId: number;
  clientCode: string;
  clientName: string;
  holiday: string;
  year: number;
  notes: string | null;
  givenBy: string | null;
  givenAt: string;
}

export async function getClientBasketsAction(
  clientId: number
): Promise<HolidayBasket[]> {
  await requirePermission("clients");
  const { rows } = await sql`
    SELECT hb.id, hb.client_id, cl.client_id AS client_code, cl.name AS client_name,
           hb.holiday, hb.year, hb.notes, u.name AS given_by, hb.given_at
    FROM holiday_baskets hb
    JOIN clients cl ON cl.id = hb.client_id
    LEFT JOIN users u ON u.id = hb.given_by
    WHERE hb.client_id = ${clientId}
    ORDER BY hb.year DESC, hb.given_at DESC;
  `;
  return rows.map((r) => ({
    id: r.id,
    clientId: r.client_id,
    clientCode: r.client_code,
    clientName: r.client_name,
    holiday: r.holiday,
    year: r.year,
    notes: r.notes,
    givenBy: r.given_by,
    givenAt: new Date(r.given_at).toLocaleDateString(),
  }));
}

export async function addBasketAction(
  formData: FormData
): Promise<ActionResult> {
  const session = await requirePermission("clients");
  const clientId = Number(formData.get("clientId"));
  const holiday = String(formData.get("holiday") || "").trim();
  const year = Number(formData.get("year")) || new Date().getFullYear();
  const notes = String(formData.get("notes") || "").trim() || null;
  if (!clientId) return { success: false, error: "Missing client." };
  if (!holiday) return { success: false, error: "Choose a holiday." };
  await sql`
    INSERT INTO holiday_baskets (client_id, holiday, year, notes, given_by)
    VALUES (${clientId}, ${holiday}, ${year}, ${notes}, ${session.userId});
  `;
  revalidatePath("/dashboard/admin/clients");
  revalidatePath("/dashboard/admin/baskets");
  return { success: true };
}

export async function deleteBasketAction(id: number): Promise<ActionResult> {
  await requirePermission("clients");
  await sql`DELETE FROM holiday_baskets WHERE id = ${id};`;
  revalidatePath("/dashboard/admin/clients");
  revalidatePath("/dashboard/admin/baskets");
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
  await requirePermission("clients");
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
