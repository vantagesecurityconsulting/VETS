import "server-only";
import { sql, tablesExist } from "@/lib/db";
import { hashPin } from "@/lib/auth";
import { SEED_CATEGORIES } from "@/lib/seed-data";

/**
 * Create all application tables (idempotent — safe to call repeatedly).
 */
export async function createTables(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      pin TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('manager', 'volunteer')),
      must_change_pin BOOLEAN NOT NULL DEFAULT false,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS categories (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      point_value INTEGER NOT NULL DEFAULT 1,
      display_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS items (
      id SERIAL PRIMARY KEY,
      category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      unit_price NUMERIC(10,2) NOT NULL DEFAULT 0,
      display_order INTEGER NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS inventory (
      id SERIAL PRIMARY KEY,
      item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      quantity INTEGER NOT NULL DEFAULT 0,
      expiry_date DATE,
      last_updated TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS clients (
      id SERIAL PRIMARY KEY,
      client_id TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      family_size INTEGER NOT NULL DEFAULT 1,
      point_budget INTEGER NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      type TEXT NOT NULL CHECK (type IN ('stock_in', 'stock_out', 'audit')),
      client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
      volunteer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS transaction_items (
      id SERIAL PRIMARY KEY,
      transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
      item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      quantity INTEGER NOT NULL,
      point_value_at_time INTEGER NOT NULL DEFAULT 0
    );
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS audit_counts (
      id SERIAL PRIMARY KEY,
      item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      counted_quantity INTEGER NOT NULL,
      system_quantity INTEGER NOT NULL,
      discrepancy INTEGER NOT NULL,
      volunteer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_items_category ON items(category_id);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_inventory_item ON inventory(item_id);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_txn_items_txn ON transaction_items(transaction_id);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_audit_item ON audit_counts(item_id);`;
}

/**
 * Seed the default manager account. Assumes an empty users table.
 */
export async function seedManager(): Promise<void> {
  // Default manager (PIN 0000, must change on first login)
  const managerPin = await hashPin("0000");
  await sql`
    INSERT INTO users (name, pin, role, must_change_pin, is_active)
    VALUES ('Manager', ${managerPin}, 'manager', true, true);
  `;
}

/**
 * Seed the catalog (categories + items + zero-quantity inventory rows).
 * Assumes the catalog tables are empty.
 */
export async function seedCatalog(): Promise<void> {
  let catOrder = 0;
  for (const cat of SEED_CATEGORIES) {
    const { rows } = await sql`
      INSERT INTO categories (name, point_value, display_order)
      VALUES (${cat.name}, ${cat.pointValue}, ${catOrder})
      RETURNING id;
    `;
    const categoryId = rows[0].id as number;
    catOrder += 1;

    let itemOrder = 0;
    for (const itemName of cat.items) {
      const itemResult = await sql`
        INSERT INTO items (category_id, name, unit_price, display_order, is_active)
        VALUES (${categoryId}, ${itemName}, ${cat.price}, ${itemOrder}, true)
        RETURNING id;
      `;
      const itemId = itemResult.rows[0].id as number;
      itemOrder += 1;
      await sql`
        INSERT INTO inventory (item_id, quantity, expiry_date)
        VALUES (${itemId}, 0, NULL);
      `;
    }
  }
}

/**
 * Seed the default manager and the full catalog. Assumes empty tables.
 */
export async function seedData(): Promise<void> {
  await seedManager();
  await seedCatalog();
}

/**
 * Wipe the catalog and all stock/transaction history, then reload the
 * default catalog. Manager-triggered. Does NOT touch user or client accounts.
 */
export async function resetCatalog(): Promise<void> {
  // Deleting transactions cascades to transaction_items; deleting categories
  // cascades to items -> inventory / transaction_items / audit_counts.
  await sql`DELETE FROM transactions;`;
  await sql`DELETE FROM audit_counts;`;
  await sql`DELETE FROM categories;`;
  await seedCatalog();
}

// In-memory guard so a single warm serverless instance doesn't re-check on
// every request after it has confirmed the DB is ready.
let initialized = false;

/**
 * Lightweight, idempotent schema migrations for existing databases.
 * (CREATE TABLE IF NOT EXISTS does not add new columns to existing tables.)
 */
export async function runMigrations(): Promise<void> {
  await sql`ALTER TABLE items ADD COLUMN IF NOT EXISTS unit_price NUMERIC(10,2) NOT NULL DEFAULT 0;`;
}

/**
 * Ensure the database schema exists, is migrated, and is seeded. Safe to call
 * on every request — it does its work once per warm instance. This lets the
 * app self-initialize the first time it is used, so visiting /api/setup
 * manually is optional.
 */
export async function ensureInitialized(): Promise<void> {
  if (initialized) return;
  await createTables(); // idempotent (CREATE TABLE IF NOT EXISTS)
  await runMigrations(); // idempotent (ADD COLUMN IF NOT EXISTS)
  // Only seed if there are no users yet.
  const { rows } = await sql`SELECT COUNT(*)::int AS count FROM users;`;
  if (rows[0].count === 0) {
    await seedData();
  }
  initialized = true;
}
