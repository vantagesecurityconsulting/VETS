import { requirePermission } from "@/lib/auth";
import { sql } from "@/lib/db";
import ClientsManager, { type ClientRow } from "./ClientsManager";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  await requirePermission("clients");
  const { rows } = await sql`
    SELECT c.id, c.client_id, c.name, c.family_size, c.point_budget, c.is_active,
           c.archive_reason, c.date_of_birth, c.gender, c.address, c.contact,
           c.email, c.service_number, c.notes,
           (SELECT COUNT(*)::int FROM family_members fm WHERE fm.client_id = c.id) AS member_count
    FROM clients c
    ORDER BY c.is_active DESC, c.name;
  `;
  const clients: ClientRow[] = rows.map((r) => ({
    id: r.id,
    clientId: r.client_id,
    name: r.name,
    familySize: r.family_size,
    pointBudget: r.point_budget,
    isActive: r.is_active,
    archiveReason: r.archive_reason,
    memberCount: r.member_count,
    dateOfBirth: r.date_of_birth ? String(r.date_of_birth) : null,
    gender: r.gender,
    address: r.address,
    contact: r.contact,
    email: r.email,
    serviceNumber: r.service_number,
    notes: r.notes,
  }));

  return <ClientsManager clients={clients} />;
}
