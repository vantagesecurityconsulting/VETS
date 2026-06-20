"use server";

import { sql } from "@/lib/db";
import { requireManager } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export interface ActionResult {
  success: boolean;
  error?: string;
}

export async function updateInventoryAction(
  formData: FormData
): Promise<ActionResult> {
  await requireManager();
  const itemId = Number(formData.get("itemId"));
  const quantity = Math.max(0, Number(formData.get("quantity")) || 0);
  const expiryRaw = String(formData.get("expiry") || "").trim();
  const expiry = expiryRaw === "" ? null : expiryRaw;
  if (!itemId) return { success: false, error: "Invalid item." };

  await sql`
    UPDATE inventory
    SET quantity = ${quantity}, expiry_date = ${expiry}, last_updated = now()
    WHERE item_id = ${itemId};
  `;
  revalidatePath("/dashboard/admin/inventory");
  return { success: true };
}
