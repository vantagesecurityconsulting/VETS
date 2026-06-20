import { NextResponse } from "next/server";
import { sql, tablesExist } from "@/lib/db";
import { hashPin } from "@/lib/auth";
import { SEED_CATEGORIES } from "@/lib/seed-data";
import { validateEnv } from "@/lib/env";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function createTables() {
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

  // Helpful indexes
  await sql`CREATE INDEX IF NOT EXISTS idx_items_category ON items(category_id);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_inventory_item ON inventory(item_id);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_txn_items_txn ON transaction_items(transaction_id);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_audit_item ON audit_counts(item_id);`;
}

async function seedData() {
  // Seed default manager (PIN 0000, must change on first login)
  const managerPin = await hashPin("0000");
  await sql`
    INSERT INTO users (name, pin, role, must_change_pin, is_active)
    VALUES ('Manager', ${managerPin}, 'manager', true, true);
  `;

  // Seed categories + items + inventory rows
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
        INSERT INTO items (category_id, name, display_order, is_active)
        VALUES (${categoryId}, ${itemName}, ${itemOrder}, true)
        RETURNING id;
      `;
      const itemId = itemResult.rows[0].id as number;
      itemOrder += 1;

      // Each item starts with a zero-quantity inventory row.
      await sql`
        INSERT INTO inventory (item_id, quantity, expiry_date)
        VALUES (${itemId}, 0, NULL);
      `;
    }
  }
}

export async function GET() {
  try {
    validateEnv();
  } catch (err) {
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 }
    );
  }

  try {
    if (await tablesExist()) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Database already initialized. Setup can only be run once.",
        },
        { status: 409 }
      );
    }

    await createTables();
    await seedData();

    return NextResponse.json({
      success: true,
      message: "Database initialized and seeded",
    });
  } catch (err) {
    console.error("Setup failed:", err);
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}
