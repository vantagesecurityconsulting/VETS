import "./db-env";
import { sql } from "@vercel/postgres";

/**
 * Thin re-export of the Vercel Postgres tagged-template client.
 * All database access in the app goes through raw SQL via this `sql` helper.
 *
 * Usage:
 *   const { rows } = await sql`SELECT * FROM users WHERE id = ${id}`;
 */
export { sql };

/**
 * Returns true if the core application tables already exist.
 * Used by the setup endpoint to ensure it only runs once.
 */
export async function tablesExist(): Promise<boolean> {
  const { rows } = await sql`
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'users'
    ) AS exists;
  `;
  return rows[0]?.exists === true;
}
