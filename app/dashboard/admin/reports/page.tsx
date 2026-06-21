import { requireManager } from "@/lib/auth";
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
} from "@/lib/reports";
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

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: { report?: string; range?: string; from?: string; to?: string };
}) {
  await requireManager();

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
      const [rows, total] = await Promise.all([
        donationsReport(range),
        donatedValueTotal(range),
      ]);
      content = (
        <>
          <div className="mt-4 rounded-xl border border-gold/30 bg-gold/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-charcoal/60">
              Total value donated ({range.label})
            </p>
            <p className="text-3xl font-bold text-navy">{fmtMoney(total)}</p>
          </div>
          <Table
            rows={rows}
            columns={[
              { key: "item_name", label: "Item" },
              { key: "category_name", label: "Category" },
              { key: "total", label: "Received" },
              { key: "value", label: "Value", format: fmtMoney },
            ]}
          />
        </>
      );
      break;
    }
    case "value-clients": {
      const [rows, distributed] = await Promise.all([
        valueByClientReport(range),
        distributedValueTotal(range),
      ]);
      content = (
        <>
          <div className="mt-4 rounded-xl border border-gold/30 bg-gold/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-charcoal/60">
              Total value given to clients ({range.label})
            </p>
            <p className="text-3xl font-bold text-navy">{fmtMoney(distributed)}</p>
          </div>
          <Table
            rows={rows}
            columns={[
              { key: "client_name", label: "Client" },
              { key: "client_id", label: "Client ID" },
              { key: "visits", label: "Visits" },
              { key: "items", label: "Items" },
              { key: "value", label: "Value Received", format: fmtMoney },
            ]}
          />
        </>
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
