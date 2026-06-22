import Link from "next/link";
import { requireManager } from "@/lib/auth";
import {
  getOverviewStats,
  getExpiringItems,
  getLifetimeTotals,
  getCreditSnapshot,
  DEFAULT_EXPIRY_THRESHOLD_DAYS,
} from "@/lib/admin-queries";
import { WEIGHT_UNIT } from "@/lib/units";
import ExpiryAlert from "@/components/ExpiryAlert";

export const dynamic = "force-dynamic";

const adminLinks = [
  { href: "/dashboard/admin/clients", title: "Clients", desc: "Manage client records & visit history" },
  { href: "/dashboard/admin/inventory", title: "Inventory", desc: "Stock levels & expiry tracking" },
  { href: "/dashboard/admin/items", title: "Items & Categories", desc: "Manage catalog & point values" },
  { href: "/dashboard/admin/volunteers", title: "Volunteers", desc: "Manage accounts & PINs" },
  { href: "/dashboard/admin/reports", title: "Reports", desc: "Full reporting suite" },
];

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className="card">
      <div className={`mb-2 h-1 w-10 rounded ${accent}`} />
      <p className="text-3xl font-bold text-navy">{value}</p>
      <p className="text-sm text-charcoal/60">{label}</p>
    </div>
  );
}

const money = (n: number) =>
  n.toLocaleString("en-CA", { style: "currency", currency: "CAD" });
const number = (n: number) => n.toLocaleString("en-CA");

export default async function AdminHome() {
  await requireManager();
  const [stats, expiring, lifetime, credits] = await Promise.all([
    getOverviewStats(),
    getExpiringItems(DEFAULT_EXPIRY_THRESHOLD_DAYS),
    getLifetimeTotals(),
    getCreditSnapshot(),
  ]);

  const coverage =
    credits.monthlyCreditsExpected > 0
      ? Math.round((credits.creditsOnHand / credits.monthlyCreditsExpected) * 100)
      : 0;

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-navy">
        Manager Dashboard
      </h1>
      <p className="mt-1 text-charcoal/70">This week at a glance.</p>

      {/* Lifetime impact */}
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <div className="card bg-navy text-white">
          <p className="text-3xl font-bold">{number(lifetime.veteransHelped)}</p>
          <p className="text-sm text-white/80">Veterans helped (all-time)</p>
        </div>
        <div className="card bg-gold text-white">
          <p className="text-3xl font-bold">{money(lifetime.valueDistributed)}</p>
          <p className="text-sm text-white/80">Value distributed (all-time)</p>
        </div>
        <div className="card bg-military text-white">
          <p className="text-3xl font-bold">
            {number(lifetime.weightDistributed)} {WEIGHT_UNIT}
          </p>
          <p className="text-sm text-white/80">Food distributed (all-time)</p>
        </div>
      </div>

      {/* Monthly credit snapshot */}
      <div className="mt-4 rounded-xl border border-navy/20 bg-white p-5 shadow-sm">
        <h2 className="font-heading text-lg font-bold text-navy">
          Monthly Credits
        </h2>
        <p className="text-sm text-charcoal/60">
          Each family shops once a month (credits don&apos;t roll over). Updates
          automatically as inventory and the client list change.
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-2xl font-bold text-navy">
              {number(credits.monthlyCreditsExpected)}
            </p>
            <p className="text-sm text-charcoal/60">
              Credits expected to be shopped / month
              <span className="block text-xs text-charcoal/40">
                ({credits.activeClients} active families)
              </span>
            </p>
          </div>
          <div>
            <p className="text-2xl font-bold text-navy">
              {number(credits.creditsOnHand)}
            </p>
            <p className="text-sm text-charcoal/60">
              Credits on hand (current food inventory)
            </p>
          </div>
          <div>
            <p
              className={`text-2xl font-bold ${
                coverage >= 100 ? "text-green-700" : "text-military"
              }`}
            >
              {coverage}%
            </p>
            <p className="text-sm text-charcoal/60">
              Inventory coverage of monthly demand
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Clients served this week"
          value={stats.clientsServedThisWeek}
          accent="bg-navy"
        />
        <StatCard
          label="Items distributed this week"
          value={stats.itemsDistributedThisWeek}
          accent="bg-gold"
        />
        <StatCard
          label="Low stock items"
          value={stats.lowStockCount}
          accent="bg-amber-500"
        />
        <StatCard
          label="Expiring soon"
          value={stats.expiringSoonCount}
          accent="bg-military"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="mb-3 font-heading text-lg font-bold text-navy">
            Quick Links
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {adminLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-xl border border-black/5 bg-white p-4 shadow-sm transition hover:shadow-md"
              >
                <p className="font-heading text-base font-bold text-navy">
                  {l.title}
                </p>
                <p className="mt-1 text-sm text-charcoal/60">{l.desc}</p>
              </Link>
            ))}
          </div>
        </div>

        <div>
          <h2 className="mb-3 font-heading text-lg font-bold text-navy">
            Expiring Soon
          </h2>
          <div className="card">
            <ExpiryAlert items={expiring} />
          </div>
        </div>
      </div>
    </div>
  );
}
