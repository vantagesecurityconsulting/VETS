"use server";

import { sql } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export interface DonationLineInput {
  itemId: number;
  quantity: number;
  expiryDate?: string | null;
}

export interface DonationResult {
  success: boolean;
  error?: string;
  totalItems?: number;
}

export async function logDonationAction(
  lines: DonationLineInput[],
  notes: string
): Promise<DonationResult> {
  const session = await requireAuth();

  const clean = lines.filter((l) => l.quantity > 0);
  if (clean.length === 0) {
    return { success: false, error: "Enter a quantity for at least one item." };
  }

  const { rows: txnRows } = await sql`
    INSERT INTO transactions (type, volunteer_id, notes)
    VALUES ('stock_in', ${session.userId}, ${notes || null})
    RETURNING id;
  `;
  const transactionId = txnRows[0].id as number;

  let total = 0;
  for (const l of clean) {
    total += l.quantity;
    await sql`
      INSERT INTO transaction_items (transaction_id, item_id, quantity, point_value_at_time)
      VALUES (${transactionId}, ${l.itemId}, ${l.quantity}, 0);
    `;
    const expiry = l.expiryDate && l.expiryDate.trim() !== "" ? l.expiryDate : null;
    if (expiry) {
      await sql`
        UPDATE inventory
        SET quantity = quantity + ${l.quantity},
            expiry_date = ${expiry},
            last_updated = now()
        WHERE item_id = ${l.itemId};
      `;
    } else {
      await sql`
        UPDATE inventory
        SET quantity = quantity + ${l.quantity},
            last_updated = now()
        WHERE item_id = ${l.itemId};
      `;
    }
  }

  return { success: true, totalItems: total };
}
