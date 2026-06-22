import "server-only";
import { sql } from "@/lib/db";

export interface DateRange {
  from: string; // ISO date (inclusive)
  to: string; // ISO date (inclusive end-of-day handled in queries)
  label: string;
}

export type RangeKey = "today" | "week" | "month" | "custom";

/**
 * Resolve a range key (+ optional custom dates) into concrete ISO dates.
 */
export function resolveRange(
  key: RangeKey,
  customFrom?: string,
  customTo?: string
): DateRange {
  const now = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const todayStr = iso(now);

  if (key === "today") {
    return { from: todayStr, to: todayStr, label: "Today" };
  }
  if (key === "week") {
    const day = now.getDay(); // 0 = Sun
    const diff = (day + 6) % 7; // days since Monday
    const monday = new Date(now);
    monday.setDate(now.getDate() - diff);
    return { from: iso(monday), to: todayStr, label: "This Week" };
  }
  if (key === "month") {
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: iso(first), to: todayStr, label: "This Month" };
  }
  // custom
  const from = customFrom || todayStr;
  const to = customTo || todayStr;
  return { from, to, label: `${from} → ${to}` };
}

// SQL bounds: from 00:00 of `from` to 23:59:59 of `to`.
function bounds(range: DateRange): { start: string; end: string } {
  return { start: `${range.from} 00:00:00`, end: `${range.to} 23:59:59` };
}

// 1. Client Visit Report
export async function clientVisitReport(range: DateRange) {
  const { start, end } = bounds(range);
  const { rows } = await sql`
    SELECT
      t.id,
      t.created_at,
      cl.name AS client_name,
      cl.client_id,
      u.name AS volunteer,
      COALESCE(SUM(ti.quantity), 0)::int AS items,
      COALESCE(SUM(ti.quantity * ti.point_value_at_time), 0)::int AS points,
      COALESCE(ROUND(SUM(ti.quantity * i.unit_price), 2), 0) AS value
    FROM transactions t
    LEFT JOIN clients cl ON cl.id = t.client_id
    LEFT JOIN users u ON u.id = t.volunteer_id
    LEFT JOIN transaction_items ti ON ti.transaction_id = t.id
    LEFT JOIN items i ON i.id = ti.item_id
    WHERE t.type = 'stock_out'
      AND t.created_at BETWEEN ${start} AND ${end}
    GROUP BY t.id, t.created_at, cl.name, cl.client_id, u.name
    ORDER BY t.created_at DESC;
  `;
  return rows;
}

// Value received per client (stock_out), and the overall donated value.
export async function valueByClientReport(range: DateRange) {
  const { start, end } = bounds(range);
  const { rows } = await sql`
    SELECT
      cl.name AS client_name,
      cl.client_id,
      COUNT(DISTINCT t.id)::int AS visits,
      COALESCE(SUM(ti.quantity), 0)::int AS items,
      COALESCE(ROUND(SUM(ti.quantity * i.unit_price), 2), 0) AS value,
      COALESCE(ROUND(SUM(ti.quantity * i.unit_weight), 2), 0) AS weight
    FROM transactions t
    JOIN clients cl ON cl.id = t.client_id
    LEFT JOIN transaction_items ti ON ti.transaction_id = t.id
    LEFT JOIN items i ON i.id = ti.item_id
    WHERE t.type = 'stock_out'
      AND t.created_at BETWEEN ${start} AND ${end}
    GROUP BY cl.name, cl.client_id
    ORDER BY value DESC;
  `;
  return rows;
}

// Total dollar value of donations (stock_in) received in the period.
export async function donatedValueTotal(range: DateRange): Promise<number> {
  const { start, end } = bounds(range);
  const { rows } = await sql`
    SELECT COALESCE(ROUND(SUM(ti.quantity * i.unit_price), 2), 0) AS value
    FROM transaction_items ti
    JOIN transactions t ON t.id = ti.transaction_id
    JOIN items i ON i.id = ti.item_id
    WHERE t.type = 'stock_in'
      AND t.created_at BETWEEN ${start} AND ${end};
  `;
  return Number(rows[0]?.value ?? 0);
}

// Total dollar value distributed to clients (stock_out) in the period.
export async function distributedValueTotal(range: DateRange): Promise<number> {
  const { start, end } = bounds(range);
  const { rows } = await sql`
    SELECT COALESCE(ROUND(SUM(ti.quantity * i.unit_price), 2), 0) AS value
    FROM transaction_items ti
    JOIN transactions t ON t.id = ti.transaction_id
    JOIN items i ON i.id = ti.item_id
    WHERE t.type = 'stock_out'
      AND t.created_at BETWEEN ${start} AND ${end};
  `;
  return Number(rows[0]?.value ?? 0);
}

// Total weight for a given transaction type in the period (gov reporting).
async function weightTotalForType(
  range: DateRange,
  type: "stock_in" | "stock_out" | "waste"
): Promise<number> {
  const { start, end } = bounds(range);
  const { rows } = await sql`
    SELECT COALESCE(ROUND(SUM(ti.quantity * i.unit_weight), 2), 0) AS weight
    FROM transaction_items ti
    JOIN transactions t ON t.id = ti.transaction_id
    JOIN items i ON i.id = ti.item_id
    WHERE t.type = ${type}
      AND t.created_at BETWEEN ${start} AND ${end};
  `;
  return Number(rows[0]?.weight ?? 0);
}

export function donatedWeightTotal(range: DateRange) {
  return weightTotalForType(range, "stock_in");
}
export function distributedWeightTotal(range: DateRange) {
  return weightTotalForType(range, "stock_out");
}

// Write-off / waste report
export async function wasteReport(range: DateRange) {
  const { start, end } = bounds(range);
  const { rows } = await sql`
    SELECT
      t.created_at,
      t.notes AS reason,
      u.name AS volunteer,
      i.name AS item_name,
      c.name AS category_name,
      ti.quantity,
      ROUND(ti.quantity * i.unit_price, 2) AS value,
      ROUND(ti.quantity * i.unit_weight, 2) AS weight
    FROM transactions t
    JOIN transaction_items ti ON ti.transaction_id = t.id
    JOIN items i ON i.id = ti.item_id
    JOIN categories c ON c.id = i.category_id
    LEFT JOIN users u ON u.id = t.volunteer_id
    WHERE t.type = 'waste'
      AND t.created_at BETWEEN ${start} AND ${end}
    ORDER BY t.created_at DESC;
  `;
  return rows;
}

// 2. Top Items Report
export async function topItemsReport(range: DateRange) {
  const { start, end } = bounds(range);
  const { rows } = await sql`
    SELECT
      i.name AS item_name,
      c.name AS category_name,
      SUM(ti.quantity)::int AS total
    FROM transaction_items ti
    JOIN transactions t ON t.id = ti.transaction_id
    JOIN items i ON i.id = ti.item_id
    JOIN categories c ON c.id = i.category_id
    WHERE t.type = 'stock_out'
      AND t.created_at BETWEEN ${start} AND ${end}
    GROUP BY i.name, c.name
    ORDER BY total DESC
    LIMIT 50;
  `;
  return rows;
}

// 3. Inventory Levels Report (not date-filtered — current snapshot)
export async function inventoryLevelsReport(lowThreshold = 5) {
  const { rows } = await sql`
    SELECT
      i.name AS item_name,
      c.name AS category_name,
      COALESCE(inv.quantity, 0) AS quantity
    FROM items i
    JOIN categories c ON c.id = i.category_id
    LEFT JOIN inventory inv ON inv.item_id = i.id
    WHERE i.is_active = true
    ORDER BY quantity ASC, c.name, i.name;
  `;
  return rows.map((r) => ({
    ...r,
    low: r.quantity <= lowThreshold,
  }));
}

// 4. Donations Report
export async function donationsReport(range: DateRange) {
  const { start, end } = bounds(range);
  const { rows } = await sql`
    SELECT
      i.name AS item_name,
      c.name AS category_name,
      SUM(ti.quantity)::int AS total,
      ROUND(SUM(ti.quantity * i.unit_price), 2) AS value,
      ROUND(SUM(ti.quantity * i.unit_weight), 2) AS weight
    FROM transaction_items ti
    JOIN transactions t ON t.id = ti.transaction_id
    JOIN items i ON i.id = ti.item_id
    JOIN categories c ON c.id = i.category_id
    WHERE t.type = 'stock_in'
      AND t.created_at BETWEEN ${start} AND ${end}
    GROUP BY i.name, c.name
    ORDER BY total DESC;
  `;
  return rows;
}

// 5. Audit / Discrepancy Report
export async function auditReport(range: DateRange) {
  const { start, end } = bounds(range);
  const { rows } = await sql`
    SELECT
      ac.created_at,
      i.name AS item_name,
      c.name AS category_name,
      ac.counted_quantity,
      ac.system_quantity,
      ac.discrepancy,
      u.name AS volunteer
    FROM audit_counts ac
    JOIN items i ON i.id = ac.item_id
    JOIN categories c ON c.id = i.category_id
    LEFT JOIN users u ON u.id = ac.volunteer_id
    WHERE ac.created_at BETWEEN ${start} AND ${end}
    ORDER BY ABS(ac.discrepancy) DESC, ac.created_at DESC;
  `;
  return rows;
}

// 6. Expiry Report (current snapshot)
export async function expiryReport() {
  const { rows } = await sql`
    SELECT
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
    ORDER BY inv.expiry_date ASC;
  `;
  return rows;
}

// 7. Volunteer Activity Report
export async function volunteerActivityReport(range: DateRange) {
  const { start, end } = bounds(range);
  const { rows } = await sql`
    SELECT
      u.name AS volunteer,
      COUNT(*) FILTER (WHERE t.type = 'stock_out')::int AS visits,
      COUNT(*) FILTER (WHERE t.type = 'stock_in')::int AS donations,
      COUNT(*) FILTER (WHERE t.type = 'audit')::int AS counts
    FROM users u
    LEFT JOIN transactions t
      ON t.volunteer_id = u.id
      AND t.created_at BETWEEN ${start} AND ${end}
    GROUP BY u.name
    ORDER BY visits DESC, donations DESC;
  `;
  return rows;
}

// 8. Points Usage Report (avg points per visit by family size)
export async function pointsUsageReport(range: DateRange) {
  const { start, end } = bounds(range);
  const { rows } = await sql`
    SELECT
      cl.family_size,
      COUNT(DISTINCT t.id)::int AS visits,
      ROUND(AVG(visit_points.points), 1) AS avg_points
    FROM transactions t
    JOIN clients cl ON cl.id = t.client_id
    JOIN (
      SELECT transaction_id, SUM(quantity * point_value_at_time) AS points
      FROM transaction_items
      GROUP BY transaction_id
    ) visit_points ON visit_points.transaction_id = t.id
    WHERE t.type = 'stock_out'
      AND t.created_at BETWEEN ${start} AND ${end}
    GROUP BY cl.family_size
    ORDER BY cl.family_size;
  `;
  return rows;
}
