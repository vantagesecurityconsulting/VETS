"use server";

import { sql } from "@/lib/db";
import { requireManager } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export interface ActionResult {
  success: boolean;
  error?: string;
}

/**
 * Delete a transaction entered in error and reverse its effect on inventory:
 *  - stock_in  (donation)  → remove the added stock
 *  - stock_out (visit)     → return the stock
 *  - waste     (write-off) → return the stock
 *  - audit     (count)     → no inventory change (count set an absolute value)
 */
export async function deleteEntryAction(
  transactionId: number
): Promise<ActionResult> {
  await requireManager();

  const { rows: txn } = await sql`SELECT type FROM transactions WHERE id = ${transactionId};`;
  if (txn.length === 0) return { success: false, error: "Entry not found." };
  const type = txn[0].type as string;

  const { rows: items } = await sql`
    SELECT item_id, quantity FROM transaction_items WHERE transaction_id = ${transactionId};
  `;

  for (const it of items) {
    if (type === "stock_in") {
      await sql`UPDATE inventory SET quantity = GREATEST(0, quantity - ${it.quantity}), last_updated = now() WHERE item_id = ${it.item_id};`;
    } else if (type === "stock_out" || type === "waste") {
      await sql`UPDATE inventory SET quantity = quantity + ${it.quantity}, last_updated = now() WHERE item_id = ${it.item_id};`;
    }
    // audit: leave inventory as-is
  }

  await sql`DELETE FROM transactions WHERE id = ${transactionId};`;
  revalidatePath("/dashboard/admin/entries");
  revalidatePath("/dashboard/admin/inventory");
  return { success: true };
}
