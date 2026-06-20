import "server-only";
import { sql } from "@/lib/db";

export const DEFAULT_EXPIRY_THRESHOLD_DAYS = 7;
export const DEFAULT_LOW_STOCK_THRESHOLD = 5;

export interface OverviewStats {
  clientsServedThisWeek: number;
  itemsDistributedThisWeek: number;
  lowStockCount: number;
  expiringSoonCount: number;
}

export async function getOverviewStats(
  lowStockThreshold = DEFAULT_LOW_STOCK_THRESHOLD,
  expiryThresholdDays = DEFAULT_EXPIRY_THRESHOLD_DAYS
): Promise<OverviewStats> {
  const { rows: clientRows } = await sql`
    SELECT COUNT(DISTINCT client_id)::int AS count
    FROM transactions
    WHERE type = 'stock_out'
      AND client_id IS NOT NULL
      AND created_at >= date_trunc('week', now());
  `;

  const { rows: itemRows } = await sql`
    SELECT COALESCE(SUM(ti.quantity), 0)::int AS count
    FROM transaction_items ti
    JOIN transactions t ON t.id = ti.transaction_id
    WHERE t.type = 'stock_out'
      AND t.created_at >= date_trunc('week', now());
  `;

  const { rows: lowRows } = await sql`
    SELECT COUNT(*)::int AS count
    FROM inventory inv
    JOIN items i ON i.id = inv.item_id
    WHERE i.is_active = true AND inv.quantity <= ${lowStockThreshold};
  `;

  const { rows: expRows } = await sql.query(
    `SELECT COUNT(*)::int AS count
     FROM inventory inv
     JOIN items i ON i.id = inv.item_id
     WHERE i.is_active = true
       AND inv.expiry_date IS NOT NULL
       AND inv.quantity > 0
       AND inv.expiry_date <= (CURRENT_DATE + ($1 || ' days')::interval)`,
    [expiryThresholdDays]
  );

  return {
    clientsServedThisWeek: clientRows[0]?.count ?? 0,
    itemsDistributedThisWeek: itemRows[0]?.count ?? 0,
    lowStockCount: lowRows[0]?.count ?? 0,
    expiringSoonCount: expRows[0]?.count ?? 0,
  };
}

export interface ExpiringItem {
  itemId: number;
  itemName: string;
  categoryName: string;
  quantity: number;
  expiryDate: string;
  daysLeft: number;
}

export async function getExpiringItems(
  thresholdDays = DEFAULT_EXPIRY_THRESHOLD_DAYS
): Promise<ExpiringItem[]> {
  const { rows } = await sql.query(
    `SELECT
       i.id AS item_id,
       i.name AS item_name,
       c.name AS category_name,
       inv.quantity,
       inv.expiry_date,
       (inv.expiry_date - CURRENT_DATE)::int AS days_left
     FROM inventory inv
     JOIN items i ON i.id = inv.item_id
     JOIN categories c ON c.id = i.category_id
     WHERE i.is_active = true
       AND inv.expiry_date IS NOT NULL
       AND inv.quantity > 0
       AND inv.expiry_date <= (CURRENT_DATE + ($1 || ' days')::interval)
     ORDER BY inv.expiry_date ASC`,
    [thresholdDays]
  );
  return rows.map((r) => ({
    itemId: r.item_id,
    itemName: r.item_name,
    categoryName: r.category_name,
    quantity: r.quantity,
    expiryDate: String(r.expiry_date),
    daysLeft: r.days_left,
  }));
}
