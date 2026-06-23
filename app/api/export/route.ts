import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession, getCurrentPermissions } from "@/lib/auth";
import { toCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

type Export = { headers: string[]; rows: unknown[][] };

async function buildExport(type: string): Promise<Export | null> {
  switch (type) {
    case "clients": {
      const { rows } = await sql`
        SELECT c.client_id, c.name, c.family_size, c.point_budget,
               c.date_of_birth, c.gender, c.contact, c.email, c.address,
               c.service_number, c.notes,
               CASE WHEN c.is_active THEN 'active' ELSE 'archived' END AS status,
               c.archive_reason, c.created_at,
               (SELECT COUNT(*) FROM family_members fm WHERE fm.client_id = c.id) AS members
        FROM clients c ORDER BY c.name;
      `;
      return {
        headers: ["Client ID", "Name", "Family Size", "Credits", "Date of Birth", "Gender", "Contact", "Email", "Address", "Service Number", "Allergies / Notes", "Status", "Archive Reason", "Created", "Members On File"],
        rows: rows.map((r) => [r.client_id, r.name, r.family_size, r.point_budget, r.date_of_birth ? String(r.date_of_birth) : "", r.gender, r.contact, r.email, r.address, r.service_number, r.notes, r.status, r.archive_reason, new Date(r.created_at).toISOString().slice(0, 10), r.members]),
      };
    }
    case "family_members": {
      const { rows } = await sql`
        SELECT cl.client_id, cl.name AS household, fm.name, fm.date_of_birth, fm.gender,
               fm.contact, fm.email, fm.address, fm.service_number, fm.notes
        FROM family_members fm
        JOIN clients cl ON cl.id = fm.client_id
        ORDER BY cl.name, fm.id;
      `;
      return {
        headers: ["Client ID", "Household", "Member Name", "Date of Birth", "Gender", "Contact", "Email", "Address", "Service Number", "Allergies / Notes"],
        rows: rows.map((r) => [r.client_id, r.household, r.name, r.date_of_birth ? String(r.date_of_birth) : "", r.gender, r.contact, r.email, r.address, r.service_number, r.notes]),
      };
    }
    case "inventory": {
      const { rows } = await sql`
        SELECT c.name AS category, i.name AS item, COALESCE(inv.quantity, 0) AS qty,
               i.unit_price, i.unit_weight, inv.expiry_date
        FROM items i
        JOIN categories c ON c.id = i.category_id
        LEFT JOIN inventory inv ON inv.item_id = i.id
        WHERE i.is_active = true
        ORDER BY c.display_order, c.name, i.display_order, i.name;
      `;
      return {
        headers: ["Category", "Item", "Quantity", "Unit Price", "Unit Weight", "Total Value", "Total Weight", "Expiry"],
        rows: rows.map((r) => [r.category, r.item, r.qty, Number(r.unit_price).toFixed(2), Number(r.unit_weight), (r.qty * Number(r.unit_price)).toFixed(2), (r.qty * Number(r.unit_weight)).toFixed(2), r.expiry_date ? String(r.expiry_date) : ""]),
      };
    }
    case "transactions": {
      const { rows } = await sql`
        SELECT t.id, t.type, t.created_at, cl.name AS client, cl.client_id, u.name AS volunteer,
               COALESCE(SUM(ti.quantity),0)::int AS items,
               COALESCE(SUM(ti.quantity*ti.point_value_at_time),0)::int AS credits,
               COALESCE(ROUND(SUM(ti.quantity*i.unit_price),2),0) AS value,
               COALESCE(ROUND(SUM(ti.quantity*i.unit_weight),2),0) AS weight,
               t.notes
        FROM transactions t
        LEFT JOIN clients cl ON cl.id = t.client_id
        LEFT JOIN users u ON u.id = t.volunteer_id
        LEFT JOIN transaction_items ti ON ti.transaction_id = t.id
        LEFT JOIN items i ON i.id = ti.item_id
        GROUP BY t.id, t.type, t.created_at, cl.name, cl.client_id, u.name, t.notes
        ORDER BY t.created_at DESC;
      `;
      return {
        headers: ["ID", "Type", "Date", "Client", "Client ID", "Volunteer", "Items", "Credits", "Value", "Weight", "Notes"],
        rows: rows.map((r) => [r.id, r.type, new Date(r.created_at).toISOString(), r.client, r.client_id, r.volunteer, r.items, r.credits, r.value, r.weight, r.notes]),
      };
    }
    case "expenses": {
      const { rows } = await sql`
        SELECT e.expense_date, e.category, e.description, e.vendor, e.amount, u.name AS entered_by
        FROM expenses e LEFT JOIN users u ON u.id = e.created_by
        ORDER BY e.expense_date DESC;
      `;
      return {
        headers: ["Date", "Category", "Description", "Vendor", "Amount", "Entered By"],
        rows: rows.map((r) => [String(r.expense_date), r.category, r.description, r.vendor, Number(r.amount).toFixed(2), r.entered_by]),
      };
    }
    case "appointments": {
      const { rows } = await sql`
        SELECT a.appt_date, a.appt_time, COALESCE(cl.name, a.client_name) AS who, a.status, a.notes
        FROM appointments a LEFT JOIN clients cl ON cl.id = a.client_id
        ORDER BY a.appt_date DESC, a.appt_time;
      `;
      return {
        headers: ["Date", "Time", "Client", "Status", "Notes"],
        rows: rows.map((r) => [String(r.appt_date), r.appt_time, r.who, r.status, r.notes]),
      };
    }
    case "volunteer_hours": {
      const { rows } = await sql`
        SELECT u.name AS volunteer, vl.log_date, vl.hours, vl.note
        FROM volunteer_log vl JOIN users u ON u.id = vl.volunteer_id
        ORDER BY u.name, vl.log_date DESC;
      `;
      return {
        headers: ["Volunteer", "Date", "Hours", "Note"],
        rows: rows.map((r) => [r.volunteer, String(r.log_date), Number(r.hours), r.note]),
      };
    }
    default:
      return null;
  }
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  const perms = await getCurrentPermissions();
  if (!session || !perms.includes("export")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const type = req.nextUrl.searchParams.get("type") || "";
  try {
    const data = await buildExport(type);
    if (!data) {
      return NextResponse.json({ error: "Unknown export type" }, { status: 400 });
    }
    const csv = toCsv(data.headers, data.rows);
    const date = new Date().toISOString().slice(0, 10);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="vets-${type}-${date}.csv"`,
      },
    });
  } catch (err) {
    console.error("Export failed:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
