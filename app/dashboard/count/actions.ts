"use server";

import { sql } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export interface CountLineInput {
  itemId: number;
  countedQuantity: number;
}

export interface CountResult {
  success: boolean;
  error?: string;
  recorded?: number;
  discrepancies?: number;
}

export async function submitCountAction(
  lines: CountLineInput[],
  notes: string
): Promise<CountResult> {
  const session = await requireAuth();

  if (lines.length === 0) {
    return { success: false, error: "No counts entered." };
  }

  // Record an audit transaction for traceability.
  const { rows: txnRows } = await sql`
    INSERT INTO transactions (type, volunteer_id, notes)
    VALUES ('audit', ${session.userId}, ${notes || null})
    RETURNING id;
  `;
  const transactionId = txnRows[0].id as number;

  let discrepancies = 0;
  for (const l of lines) {
    const { rows } = await sql`
      SELECT COALESCE(quantity, 0) AS quantity FROM inventory WHERE item_id = ${l.itemId};
    `;
    const systemQty = rows[0]?.quantity ?? 0;
    const discrepancy = l.countedQuantity - systemQty;
    if (discrepancy !== 0) discrepancies += 1;

    await sql`
      INSERT INTO audit_counts
        (item_id, counted_quantity, system_quantity, discrepancy, volunteer_id)
      VALUES (${l.itemId}, ${l.countedQuantity}, ${systemQty}, ${discrepancy}, ${session.userId});
    `;
    await sql`
      INSERT INTO transaction_items (transaction_id, item_id, quantity, point_value_at_time)
      VALUES (${transactionId}, ${l.itemId}, ${l.countedQuantity}, 0);
    `;
  }

  return { success: true, recorded: lines.length, discrepancies };
}
