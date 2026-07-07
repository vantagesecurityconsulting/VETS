import "server-only";
import { sql, tablesExist } from "@/lib/db";
import { hashPin } from "@/lib/auth";
import { SEED_CATEGORIES } from "@/lib/seed-data";
import { matchPrices, average } from "@/lib/pricebook";

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
      emergency_contact TEXT,
      availability TEXT,
      strengths TEXT,
      permissions TEXT NOT NULL DEFAULT '[]',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS volunteer_log (
      id SERIAL PRIMARY KEY,
      volunteer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      log_date DATE NOT NULL DEFAULT CURRENT_DATE,
      hours NUMERIC(5,2) NOT NULL DEFAULT 0,
      note TEXT,
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
      unit_weight NUMERIC(10,3) NOT NULL DEFAULT 0,
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
    CREATE TABLE IF NOT EXISTS item_prices (
      id SERIAL PRIMARY KEY,
      item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      store TEXT NOT NULL,
      price NUMERIC(10,2) NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS clients (
      id SERIAL PRIMARY KEY,
      client_id TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      first_name TEXT,
      last_name TEXT,
      family_size INTEGER NOT NULL DEFAULT 1,
      point_budget INTEGER NOT NULL,
      date_of_birth DATE,
      gender TEXT,
      member_status TEXT,
      address TEXT,
      contact TEXT,
      email TEXT,
      service_number TEXT,
      notes TEXT,
      has_allergy BOOLEAN NOT NULL DEFAULT false,
      allergy_info TEXT,
      code_of_conduct BOOLEAN NOT NULL DEFAULT false,
      terms_of_service BOOLEAN NOT NULL DEFAULT false,
      delivery_approved BOOLEAN NOT NULL DEFAULT false,
      portal_pin TEXT,
      is_active BOOLEAN NOT NULL DEFAULT true,
      archive_reason TEXT,
      archived_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS family_members (
      id SERIAL PRIMARY KEY,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      name TEXT,
      date_of_birth DATE,
      gender TEXT,
      relation TEXT,
      address TEXT,
      contact TEXT,
      email TEXT,
      service_number TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS donors (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      contact TEXT,
      email TEXT,
      address TEXT,
      notes TEXT,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      type TEXT NOT NULL CHECK (type IN ('stock_in', 'stock_out', 'audit', 'waste')),
      client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
      donor_id INTEGER REFERENCES donors(id) ON DELETE SET NULL,
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

  await sql`
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'fulfilled', 'cancelled')),
      points_used INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      fulfilled_at TIMESTAMPTZ,
      fulfilled_by INTEGER REFERENCES users(id) ON DELETE SET NULL
    );
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS order_items (
      id SERIAL PRIMARY KEY,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      quantity INTEGER NOT NULL,
      point_value_at_time INTEGER NOT NULL DEFAULT 0
    );
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS appointments (
      id SERIAL PRIMARY KEY,
      client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
      client_name TEXT,
      appt_date DATE NOT NULL,
      appt_time TEXT,
      status TEXT NOT NULL DEFAULT 'scheduled'
        CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show')),
      notes TEXT,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS visit_gift_cards (
      id SERIAL PRIMARY KEY,
      transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
      store TEXT,
      amount NUMERIC(10,2) NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS cash_donations (
      id SERIAL PRIMARY KEY,
      donor_id INTEGER REFERENCES donors(id) ON DELETE SET NULL,
      donor_name TEXT,
      method TEXT NOT NULL DEFAULT 'Cash',
      amount NUMERIC(10,2) NOT NULL DEFAULT 0,
      gift_card_store TEXT,
      donation_date DATE NOT NULL DEFAULT CURRENT_DATE,
      notes TEXT,
      tax_receipt_needed BOOLEAN NOT NULL DEFAULT false,
      receipt_contact TEXT,
      receipt_address TEXT,
      recorded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS shifts (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      shift_date DATE NOT NULL,
      start_time TEXT,
      end_time TEXT,
      role TEXT,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS expenses (
      id SERIAL PRIMARY KEY,
      expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
      category TEXT NOT NULL,
      description TEXT,
      vendor TEXT,
      amount NUMERIC(10,2) NOT NULL DEFAULT 0,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS authorized_pickups (
      id SERIAL PRIMARY KEY,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      relationship TEXT,
      contact TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS availability (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      avail_date DATE NOT NULL,
      status TEXT NOT NULL DEFAULT 'available'
        CHECK (status IN ('available', 'unavailable')),
      start_time TEXT,
      end_time TEXT,
      note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS holiday_baskets (
      id SERIAL PRIMARY KEY,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      holiday TEXT NOT NULL,
      year INTEGER NOT NULL,
      notes TEXT,
      given_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      given_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_items_category ON items(category_id);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_inventory_item ON inventory(item_id);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_txn_items_txn ON transaction_items(transaction_id);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_audit_item ON audit_counts(item_id);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_item_prices_item ON item_prices(item_id);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appt_date);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_shifts_date ON shifts(shift_date);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_cash_donations_date ON cash_donations(donation_date);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_cash_donations_donor ON cash_donations(donor_id);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_visit_gift_cards_txn ON visit_gift_cards(transaction_id);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_holiday_baskets_client ON holiday_baskets(client_id);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_holiday_baskets_holiday ON holiday_baskets(holiday, year);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_availability_date ON availability(avail_date);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_availability_user ON availability(user_id);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_authorized_pickups_client ON authorized_pickups(client_id);`;
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
      // Pre-fill store prices from the price book where we can match.
      const storePrices = matchPrices(cat.name, itemName) ?? [];
      const unitPrice = average(storePrices);

      const itemResult = await sql`
        INSERT INTO items (category_id, name, unit_price, unit_weight, display_order, is_active)
        VALUES (${categoryId}, ${itemName}, ${unitPrice}, ${cat.weight}, ${itemOrder}, true)
        RETURNING id;
      `;
      const itemId = itemResult.rows[0].id as number;
      itemOrder += 1;
      await sql`
        INSERT INTO inventory (item_id, quantity, expiry_date)
        VALUES (${itemId}, 0, NULL);
      `;
      for (const sp of storePrices) {
        await sql`
          INSERT INTO item_prices (item_id, store, price)
          VALUES (${itemId}, ${sp.store}, ${sp.price});
        `;
      }
    }
  }
}

/**
 * Recompute an item's unit_price as the average of its store prices.
 * If it has no store prices, the existing unit_price is left untouched.
 */
export async function recomputeItemPrice(itemId: number): Promise<void> {
  const { rows } = await sql`
    SELECT COALESCE(ROUND(AVG(price), 2), 0) AS avg, COUNT(*)::int AS n
    FROM item_prices WHERE item_id = ${itemId};
  `;
  if ((rows[0]?.n ?? 0) > 0) {
    await sql`UPDATE items SET unit_price = ${rows[0].avg} WHERE id = ${itemId};`;
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
  await sql`ALTER TABLE items ADD COLUMN IF NOT EXISTS unit_weight NUMERIC(10,3) NOT NULL DEFAULT 0;`;
  // Allow the 'waste' transaction type (write-offs) on existing databases.
  await sql`ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check;`;
  await sql`
    ALTER TABLE transactions
    ADD CONSTRAINT transactions_type_check
    CHECK (type IN ('stock_in', 'stock_out', 'audit', 'waste'));
  `;
  // Client archive fields.
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS archive_reason TEXT;`;
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;`;
  // Primary client (head of household) detail fields.
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS date_of_birth DATE;`;
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS gender TEXT;`;
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS address TEXT;`;
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS contact TEXT;`;
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS email TEXT;`;
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS service_number TEXT;`;
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS notes TEXT;`;
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS delivery_approved BOOLEAN NOT NULL DEFAULT false;`;
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS portal_pin TEXT;`;
  // Allergy / food sensitivity flag (surfaces on the schedule).
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS has_allergy BOOLEAN NOT NULL DEFAULT false;`;
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS allergy_info TEXT;`;
  // Compliance sign-offs.
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS code_of_conduct BOOLEAN NOT NULL DEFAULT false;`;
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS terms_of_service BOOLEAN NOT NULL DEFAULT false;`;
  // Serving / retired member status (for who's-who reporting).
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS member_status TEXT;`;
  // Split first / last name (keep combined `name` for everything that reads it).
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS first_name TEXT;`;
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS last_name TEXT;`;
  // Best-effort backfill of existing single-field names (first word = first
  // name, remainder = last name). Only touches rows not yet split.
  await sql`
    UPDATE clients
    SET first_name = split_part(name, ' ', 1),
        last_name = CASE
          WHEN position(' ' in name) > 0
          THEN substring(name from position(' ' in name) + 1)
          ELSE ''
        END
    WHERE first_name IS NULL;
  `;
  await sql`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS donor_id INTEGER REFERENCES donors(id) ON DELETE SET NULL;`;
  // Index after the column exists (must follow the ADD COLUMN above).
  await sql`CREATE INDEX IF NOT EXISTS idx_transactions_donor ON transactions(donor_id);`;
  // Cash donation tax-receipt fields.
  await sql`ALTER TABLE cash_donations ADD COLUMN IF NOT EXISTS tax_receipt_needed BOOLEAN NOT NULL DEFAULT false;`;
  await sql`ALTER TABLE cash_donations ADD COLUMN IF NOT EXISTS receipt_contact TEXT;`;
  await sql`ALTER TABLE cash_donations ADD COLUMN IF NOT EXISTS receipt_address TEXT;`;
  // Family member extra fields.
  await sql`ALTER TABLE family_members ADD COLUMN IF NOT EXISTS email TEXT;`;
  await sql`ALTER TABLE family_members ADD COLUMN IF NOT EXISTS notes TEXT;`;
  await sql`ALTER TABLE family_members ADD COLUMN IF NOT EXISTS relation TEXT;`;
  // Volunteer profile fields.
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact TEXT;`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS availability TEXT;`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS strengths TEXT;`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions TEXT NOT NULL DEFAULT '[]';`;
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
