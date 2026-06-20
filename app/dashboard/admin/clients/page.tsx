import { requireManager } from "@/lib/auth";
import { sql } from "@/lib/db";
import type { ClientRecord } from "@/lib/queries";
import ClientsManager from "./ClientsManager";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  await requireManager();
  const { rows } = await sql`
    SELECT id, client_id, name, family_size, point_budget, is_active
    FROM clients
    ORDER BY is_active DESC, name;
  `;
  const clients: ClientRecord[] = rows.map((r) => ({
    id: r.id,
    clientId: r.client_id,
    name: r.name,
    familySize: r.family_size,
    pointBudget: r.point_budget,
    isActive: r.is_active,
  }));

  return <ClientsManager clients={clients} />;
}
