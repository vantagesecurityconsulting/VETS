import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import LogoutButton from "@/components/LogoutButton";
import NavLink from "@/components/NavLink";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Allow access even when a PIN change is pending so the change-pin page works.
  const session = await requireAuth({ allowMustChangePin: true });
  const isManager = session.role === "manager";

  return (
    <div className="min-h-screen bg-offwhite">
      {/* Top brand bar */}
      <header className="bg-navy text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="h-9 w-1.5 rounded bg-military" />
            <div className="leading-tight">
              <p className="font-heading text-lg font-bold uppercase tracking-wide">
                VETS Canada — Dartmouth
              </p>
              <p className="text-[11px] uppercase tracking-widest text-gold">
                Proudly Supported by DriveX
              </p>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-right text-sm sm:block">
              <span className="block font-semibold">{session.name}</span>
              <span className="text-xs uppercase tracking-wide text-white/70">
                {session.role}
              </span>
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* Navigation */}
      {!session.mustChangePin && (
        <nav className="border-b border-black/5 bg-white">
          <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-3 py-2">
            <NavLink href="/dashboard" exact>
              Home
            </NavLink>
            <NavLink href="/dashboard/visit">Client Visit</NavLink>
            <NavLink href="/dashboard/donation">Log Donation</NavLink>
            <NavLink href="/dashboard/count">Stock Count</NavLink>
            {isManager && (
              <>
                <span className="mx-1 self-center text-black/20">|</span>
                <NavLink href="/dashboard/admin" exact>
                  Admin
                </NavLink>
                <NavLink href="/dashboard/admin/clients">Clients</NavLink>
                <NavLink href="/dashboard/admin/inventory">Inventory</NavLink>
                <NavLink href="/dashboard/admin/items">Items</NavLink>
                <NavLink href="/dashboard/admin/volunteers">Volunteers</NavLink>
                <NavLink href="/dashboard/admin/reports">Reports</NavLink>
              </>
            )}
          </div>
        </nav>
      )}

      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>

      <footer className="border-t border-black/5 py-6 text-center text-xs text-charcoal/50">
        VETS Canada — Dartmouth Food Bank · Proudly Supported by DriveX
      </footer>
    </div>
  );
}
