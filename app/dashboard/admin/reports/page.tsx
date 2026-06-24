import { requirePermission } from "@/lib/auth";
import {
  resolveRange,
  type RangeKey,
  clientVisitReport,
  topItemsReport,
  inventoryLevelsReport,
  donationsReport,
  auditReport,
  expiryReport,
  volunteerActivityReport,
  pointsUsageReport,
  valueByClientReport,
  donatedValueTotal,
  distributedValueTotal,
  donatedWeightTotal,
  distributedWeightTotal,
  wasteReport,
  mostNeededReport,
  clientActivityReport,
  expensesReport,
  expenseTotal,
  donationsByDonorReport,
  giftCardsGivenReport,
  giftCardsGivenTotal,
} from "@/lib/reports";
import { WEIGHT_UNIT } from "@/lib/units";
import ReportControls from "./ReportControls";

export const dynamic = "force-dynamic";

interface Column {
  key: string;
  label: string;
  format?: (v: any, row: any) => React.ReactNode;
}

function Table({ columns, rows }: { columns: Column[]; rows: any[] }) {
  if (rows.length === 0) {
    return (
      <p className="mt-6 text-sm text-charcoal/50">
        No data for this report and date range.
      </p>
    );
  }
  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-black/5 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-navy/5 text-left text-navy">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className="px-3 py-2">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-black/5">
              {columns.map((c) => (
                <td key={c.key} className="px-3 py-2">
                  {c.format ? c.format(row[c.key], row) : String(row[c.key] ?? "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function fmtDate(v: any) {
  return v ? new Date(v).toLocaleString() : "—";
}

function fmtMoney(v: any) {
  return Number(v ?? 0).toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
  });
}

function fmtWeight(v: any) {
  return `${Number(v ?? 0).toLocaleString("en-CA", {
    maximumFractionDigits: 1,
  })} ${WEIGHT_UNIT}`;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: { report?: string; range?: string; from?: string; to?: string };
}) {
  await requirePermission("reports");

  const report = searchParams.report || "visits";
  const rangeKey = (searchParams.range || "week") as RangeKey;
  const range = resolveRange(rangeKey, searchParams.from, searchParams.to);

  let content: React.ReactNode = null;

  switch (report) {
    case "top-items": {
      const rows = await topItemsReport(range);
      content = (
        <Table
          rows={rows}
          columns={[
            { key: "item_name", label: "Item" },
            { key: "category_name", label: "Category" },
            { key: "total", label: "Distributed" },
          ]}
        />
      );
      break;
    }
    case "inventory": {
      const rows = await inventoryLevelsReport();
      content = (
        <Table
          rows={rows}
          columns={[
            { key: "category_name", label: "Category" },
            { key: "item_name", label: "Item" },
            { key: "quantity", label: "Qty" },
            {
              key: "low",
              label: "Status",
              format: (v) =>
                v ? (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
                    Low
                  </span>
                ) : (
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-700">
                    OK
                  </span>
                ),
            },
          ]}
        />
      );
      break;
    }
    case "donations": {
      const [rows, total, weight] = await Promise.all([
        donationsReport(range),
        donatedValueTotal(range),
        donatedWeightTotal(range),
      ]);
      content = (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-gold/30 bg-gold/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-charcoal/60">
                Total value donated ({range.label})
              </p>
              <p className="text-3xl font-bold text-navy">{fmtMoney(total)}</p>
            </div>
            <div className="rounded-xl border border-navy/20 bg-navy/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-charcoal/60">
                Total weight donated ({range.label})
              </p>
              <p className="text-3xl font-bold text-navy">{fmtWeight(weight)}</p>
            </div>
          </div>
          <Table
            rows={rows}
            columns={[
              { key: "item_name", label: "Item" },
              { key: "category_name", label: "Category" },
              { key: "total", label: "Received" },
              { key: "value", label: "Value", format: fmtMoney },
              { key: "weight", label: "Weight", format: fmtWeight },
            ]}
          />
        </>
      );
      break;
    }
    case "value-clients": {
      const [rows, distributed, distWeight] = await Promise.all([
        valueByClientReport(range),
        distributedValueTotal(range),
        distributedWeightTotal(range),
      ]);
      content = (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-gold/30 bg-gold/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-charcoal/60">
                Total value given to clients ({range.label})
              </p>
              <p className="text-3xl font-bold text-navy">{fmtMoney(distributed)}</p>
            </div>
            <div className="rounded-xl border border-navy/20 bg-navy/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-charcoal/60">
                Total weight given to clients ({range.label})
              </p>
              <p className="text-3xl font-bold text-navy">{fmtWeight(distWeight)}</p>
            </div>
          </div>
          <Table
            rows={rows}
            columns={[
              { key: "client_name", label: "Client" },
              { key: "client_id", label: "Client ID" },
              { key: "visits", label: "Visits" },
              { key: "items", label: "Items" },
              { key: "value", label: "Value Received", format: fmtMoney },
              { key: "weight", label: "Weight", format: fmtWeight },
            ]}
          />
        </>
      );
      break;
    }
    case "most-needed": {
      const rows = await mostNeededReport();
      content = (
        <>
          <p className="mt-4 text-sm text-charcoal/60">
            Low / out-of-stock items, ranked by recent demand — share this with
            donors when they ask what&apos;s needed.
          </p>
          <Table
            rows={rows}
            columns={[
              { key: "item_name", label: "Item" },
              { key: "category_name", label: "Category" },
              { key: "quantity", label: "In Stock" },
              { key: "given_30d", label: "Given (30d)" },
            ]}
          />
        </>
      );
      break;
    }
    case "client-activity": {
      const rows = await clientActivityReport(60);
      content = (
        <>
          <p className="mt-4 text-sm text-charcoal/60">
            Visit frequency per active family. Rows flagged 🔔 haven&apos;t
            visited in 60+ days (or never) — consider a check-in.
          </p>
          <Table
            rows={rows}
            columns={[
              {
                key: "client_name",
                label: "Client",
                format: (v, row) => (row.inactive ? `🔔 ${v}` : v),
              },
              { key: "client_id", label: "Client ID" },
              { key: "family_size", label: "Family" },
              { key: "visits", label: "Visits" },
              { key: "last_visit", label: "Last Visit", format: (v) => (v ? new Date(v).toLocaleDateString() : "never") },
              {
                key: "days_since",
                label: "Days Since",
                format: (v) => (v === null ? "—" : v),
              },
            ]}
          />
        </>
      );
      break;
    }
    case "expenses": {
      const [rows, total] = await Promise.all([
        expensesReport(range),
        expenseTotal(range),
      ]);
      content = (
        <>
          <div className="mt-4 rounded-xl border border-military/30 bg-military/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-charcoal/60">
              Total expenses ({range.label})
            </p>
            <p className="text-3xl font-bold text-navy">{fmtMoney(total)}</p>
          </div>
          <Table
            rows={rows}
            columns={[
              { key: "expense_date", label: "Date", format: (v) => (v ? new Date(v).toLocaleDateString() : "—") },
              { key: "category", label: "Category" },
              { key: "description", label: "Description" },
              { key: "vendor", label: "Vendor" },
              { key: "amount", label: "Amount", format: fmtMoney },
              { key: "entered_by", label: "By" },
            ]}
          />
        </>
      );
      break;
    }
    case "donations-by-donor": {
      const rows = await donationsByDonorReport(range);
      content = (
        <Table
          rows={rows}
          columns={[
            { key: "donor", label: "Donor" },
            { key: "donations", label: "Drop-offs" },
            { key: "items", label: "Items" },
            { key: "value", label: "Value", format: fmtMoney },
            { key: "weight", label: "Weight", format: fmtWeight },
          ]}
        />
      );
      break;
    }
    case "gift-cards": {
      const [rows, total] = await Promise.all([
        giftCardsGivenReport(range),
        giftCardsGivenTotal(range),
      ]);
      content = (
        <>
          <div className="mt-4 rounded-xl border border-gold/30 bg-gold/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-charcoal/60">
              Total gift cards given ({range.label})
            </p>
            <p className="text-3xl font-bold text-navy">{fmtMoney(total)}</p>
          </div>
          <Table
            rows={rows}
            columns={[
              { key: "created_at", label: "Date", format: fmtDate },
              { key: "client_name", label: "Client" },
              { key: "client_id", label: "Client ID" },
              { key: "store", label: "Store" },
              { key: "amount", label: "Amount", format: fmtMoney },
              { key: "volunteer", label: "By" },
            ]}
          />
        </>
      );
      break;
    }
    case "waste": {
      const rows = await wasteReport(range);
      content = (
        <Table
          rows={rows}
          columns={[
            { key: "created_at", label: "Date", format: fmtDate },
            { key: "category_name", label: "Category" },
            { key: "item_name", label: "Item" },
            { key: "quantity", label: "Qty" },
            { key: "reason", label: "Reason" },
            { key: "value", label: "Value", format: fmtMoney },
            { key: "weight", label: "Weight", format: fmtWeight },
            { key: "volunteer", label: "By" },
          ]}
        />
      );
      break;
    }
    case "audit": {
      const rows = await auditReport(range);
      content = (
        <Table
          rows={rows}
          columns={[
            { key: "created_at", label: "Date", format: fmtDate },
            { key: "category_name", label: "Category" },
            { key: "item_name", label: "Item" },
            { key: "counted_quantity", label: "Counted" },
            { key: "system_quantity", label: "System" },
            {
              key: "discrepancy",
              label: "Discrepancy",
              format: (v) => (
                <span
                  className={
                    v === 0
                      ? "text-charcoal/50"
                      : "font-bold text-military"
                  }
                >
                  {v > 0 ? `+${v}` : v}
                </span>
              ),
            },
            { key: "volunteer", label: "Volunteer" },
          ]}
        />
      );
      break;
    }
    case "expiry": {
      const rows = await expiryReport();
      content = (
        <Table
          rows={rows}
          columns={[
            { key: "category_name", label: "Category" },
            { key: "item_name", label: "Item" },
            { key: "quantity", label: "Qty" },
            { key: "expiry_date", label: "Expiry", format: (v) => String(v) },
            {
              key: "days_left",
              label: "Days Left",
              format: (v) => (
                <span
                  className={
                    v < 0
                      ? "font-bold text-military"
                      : v <= 7
                      ? "font-bold text-amber-600"
                      : "text-charcoal/60"
                  }
                >
                  {v < 0 ? `${v} (expired)` : v}
                </span>
              ),
            },
          ]}
        />
      );
      break;
    }
    case "volunteers": {
      const rows = await volunteerActivityReport(range);
      content = (
        <Table
          rows={rows}
          columns={[
            { key: "volunteer", label: "Volunteer" },
            { key: "visits", label: "Visits" },
            { key: "donations", label: "Donations" },
            { key: "counts", label: "Counts" },
          ]}
        />
      );
      break;
    }
    case "points": {
      const rows = await pointsUsageReport(range);
      content = (
        <Table
          rows={rows}
          columns={[
            { key: "family_size", label: "Family Size" },
            { key: "visits", label: "Visits" },
            { key: "avg_points", label: "Avg Points / Visit" },
          ]}
        />
      );
      break;
    }
    default: {
      const rows = await clientVisitReport(range);
      content = (
        <Table
          rows={rows}
          columns={[
            { key: "created_at", label: "Date", format: fmtDate },
            { key: "client_name", label: "Client" },
            { key: "client_id", label: "Client ID" },
            { key: "items", label: "Items" },
            { key: "points", label: "Points" },
            { key: "value", label: "Value", format: fmtMoney },
            { key: "volunteer", label: "Volunteer" },
          ]}
        />
      );
    }
  }

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-navy">Reports</h1>
      <p className="mt-1 text-charcoal/70">
        Showing <span className="font-semibold">{range.label}</span> (inventory
        & expiry reports show current snapshot).
      </p>
      <div className="mt-4">
        <ReportControls
          report={report}
          range={rangeKey}
          from={range.from}
          to={range.to}
        />
      </div>
      {content}
    </div>
  );
}
