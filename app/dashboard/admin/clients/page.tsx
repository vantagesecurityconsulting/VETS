import { requireManager } from "@/lib/auth";
import { sql } from "@/lib/db";
import ClientsManager, { type ClientRow } from "./ClientsManager";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  await requireManager();
  const { rows } = await sql`
    SELECT id, client_id, name, family_size, point_budget, is_active,
           archive_reason, member_count
    FROM (
      SELECT c.*,
             (SELECT COUNT(*)::int FROM family_members fm WHERE fm.client_id = c.id) AS member_count
      FROM clients c
    ) c
    ORDER BY is_active DESC, name;
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
  }));

  return <ClientsManager clients={clients} />;
}
