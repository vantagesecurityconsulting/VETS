import { requireManager } from "@/lib/auth";
import { sql } from "@/lib/db";
import VolunteersManager, { type UserRow } from "./VolunteersManager";

export const dynamic = "force-dynamic";

export default async function VolunteersPage() {
  await requireManager();
  const { rows } = await sql`
    SELECT id, name, role, is_active, created_at
    FROM users
    ORDER BY is_active DESC, role, name;
  `;
  const users: UserRow[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    role: r.role,
    isActive: r.is_active,
    createdAt: new Date(r.created_at).toLocaleDateString(),
  }));

  return <VolunteersManager users={users} />;
}
