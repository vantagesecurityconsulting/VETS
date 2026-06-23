import { requirePermission } from "@/lib/auth";

export const dynamic = "force-dynamic";

const EXPORTS = [
  { type: "clients", title: "Clients", desc: "All client records, credits, status, archive reasons" },
  { type: "family_members", title: "Family Members", desc: "Household members with details & allergy notes" },
  { type: "inventory", title: "Inventory", desc: "Current stock with prices, weights, values, expiry" },
  { type: "transactions", title: "Transactions", desc: "Every visit, donation, count & write-off" },
  { type: "expenses", title: "Expenses", desc: "Recorded spending by date and category" },
  { type: "appointments", title: "Appointments", desc: "Booked shopping appointments" },
  { type: "volunteer_hours", title: "Volunteer Hours", desc: "Logged hours & activity notes" },
];

export default async function ExportPage() {
  await requirePermission("export");

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-navy">
        Data Export &amp; Backups
      </h1>
      <p className="mt-1 text-charcoal/70">
        Download any table as a CSV file. Open these in Excel, Google Sheets, or
        Airtable, or keep them as off-site backups. We recommend a monthly
        backup of each.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {EXPORTS.map((e) => (
          <div
            key={e.type}
            className="flex items-center justify-between gap-3 rounded-xl border border-black/5 bg-white p-4 shadow-sm"
          >
            <div>
              <p className="font-heading text-base font-bold text-navy">{e.title}</p>
              <p className="text-sm text-charcoal/60">{e.desc}</p>
            </div>
            <a
              href={`/api/export?type=${e.type}`}
              className="btn-primary shrink-0 text-sm"
              download
            >
              Download CSV
            </a>
          </div>
        ))}
      </div>

      <p className="mt-6 text-xs text-charcoal/50">
        Tip: in Airtable, create a base and use “Add from CSV file” on each of
        these downloads to mirror your data there for browsing or sharing.
      </p>
    </div>
  );
}
