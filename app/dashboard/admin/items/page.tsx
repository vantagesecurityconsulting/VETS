import { requireManager } from "@/lib/auth";
import { sql } from "@/lib/db";
import ItemsManager, { type AdminCategory } from "./ItemsManager";

export const dynamic = "force-dynamic";

export default async function ItemsPage() {
  await requireManager();
  const { rows } = await sql`
    SELECT
      c.id AS category_id,
      c.name AS category_name,
      c.point_value,
      c.display_order AS cat_order,
      i.id AS item_id,
      i.name AS item_name,
      i.unit_price,
      i.is_active,
      i.display_order AS item_order
    FROM categories c
    LEFT JOIN items i ON i.category_id = c.id
    ORDER BY c.display_order, c.name, i.display_order, i.name;
  `;

  const map = new Map<number, AdminCategory>();
  for (const r of rows) {
    let cat = map.get(r.category_id);
    if (!cat) {
      cat = {
        id: r.category_id,
        name: r.category_name,
        pointValue: r.point_value,
        items: [],
      };
      map.set(r.category_id, cat);
    }
    if (r.item_id) {
      cat.items.push({
        id: r.item_id,
        name: r.item_name,
        unitPrice: Number(r.unit_price),
        isActive: r.is_active,
      });
    }
  }

  return <ItemsManager categories={Array.from(map.values())} />;
}
