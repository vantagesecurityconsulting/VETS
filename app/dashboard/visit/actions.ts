"use server";

import { sql } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { searchClients, type ClientRecord } from "@/lib/queries";

export async function searchClientsAction(
  term: string
): Promise<ClientRecord[]> {
  await requireAuth();
  if (!term || term.trim().length === 0) return [];
  return searchClients(term);
}

export interface MonthStatus {
  shoppedThisMonth: boolean;
  lastVisit: string | null;
}

/** Has this client already shopped in the current calendar month? */
export async function getClientMonthStatusAction(
  clientId: number
): Promise<MonthStatus> {
  await requireAuth();
  const { rows } = await sql`
    SELECT
      MAX(created_at) AS last_visit,
      COUNT(*) FILTER (WHERE created_at >= date_trunc('month', now()))::int AS this_month
    FROM transactions
    WHERE type = 'stock_out' AND client_id = ${clientId};
  `;
  return {
    shoppedThisMonth: (rows[0]?.this_month ?? 0) > 0,
    lastVisit: rows[0]?.last_visit ? new Date(rows[0].last_visit).toLocaleDateString() : null,
  };
}

export interface VisitLineInput {
  itemId: number;
  quantity: number;
}

export interface ConfirmVisitResult {
  success: boolean;
  error?: string;
  transactionId?: number;
  pointsUsed?: number;
}

export async function confirmVisitAction(
  clientId: number,
  lines: VisitLineInput[],
  notes: string
): Promise<ConfirmVisitResult> {
  const session = await requireAuth();

  const cleanLines = lines.filter((l) => l.quantity > 0);
  if (cleanLines.length === 0) {
    return { success: false, error: "No items selected." };
  }

  // Look up point values (snapshot) for each item via its category.
  const itemIds = cleanLines.map((l) => l.itemId);
  const { rows: itemRows } = await sql.query(
    `SELECT i.id AS item_id, c.point_value
     FROM items i JOIN categories c ON c.id = i.category_id
     WHERE i.id = ANY($1::int[])`,
    [itemIds]
  );
  const pointMap = new Map<number, number>(
    itemRows.map((r) => [r.item_id, r.point_value])
  );

  let pointsUsed = 0;
  for (const l of cleanLines) {
    pointsUsed += (pointMap.get(l.itemId) ?? 0) * l.quantity;
  }

  // Create the stock_out transaction.
  const { rows: txnRows } = await sql`
    INSERT INTO transactions (type, client_id, volunteer_id, notes)
    VALUES ('stock_out', ${clientId}, ${session.userId}, ${notes || null})
    RETURNING id;
  `;
  const transactionId = txnRows[0].id as number;

  for (const l of cleanLines) {
    const pv = pointMap.get(l.itemId) ?? 0;
    await sql`
      INSERT INTO transaction_items (transaction_id, item_id, quantity, point_value_at_time)
      VALUES (${transactionId}, ${l.itemId}, ${l.quantity}, ${pv});
    `;
    // Deduct from inventory (allow going to zero, not below).
    await sql`
      UPDATE inventory
      SET quantity = GREATEST(0, quantity - ${l.quantity}),
          last_updated = now()
      WHERE item_id = ${l.itemId};
    `;
  }

  return { success: true, transactionId, pointsUsed };
}
