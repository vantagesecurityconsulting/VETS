import { requireAuth } from "@/lib/auth";
import { sql } from "@/lib/db";
import ScheduleCalendar, { type Appt } from "./ScheduleCalendar";

export const dynamic = "force-dynamic";

function mondayOf(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay(); // 0 Sun
  const diff = (day + 6) % 7; // days since Monday
  x.setDate(x.getDate() - diff);
  x.setHours(0, 0, 0, 0);
  return x;
}
const iso = (d: Date) => d.toISOString().slice(0, 10);

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: { week?: string };
}) {
  await requireAuth();

  const base = searchParams.week ? new Date(searchParams.week) : new Date();
  const start = mondayOf(isNaN(base.getTime()) ? new Date() : base);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  const { rows } = await sql`
    SELECT a.id, a.client_id, a.client_name, a.appt_date, a.appt_time, a.status, a.notes,
           cl.name AS client_record_name
    FROM appointments a
    LEFT JOIN clients cl ON cl.id = a.client_id
    WHERE a.appt_date BETWEEN ${iso(start)}::date AND ${iso(end)}::date
    ORDER BY a.appt_date, a.appt_time NULLS LAST, a.id;
  `;

  const appts: Appt[] = rows.map((r) => ({
    id: r.id,
    date: iso(new Date(r.appt_date)),
    time: r.appt_time,
    name: r.client_record_name || r.client_name || "(unnamed)",
    status: r.status,
    notes: r.notes,
  }));

  return <ScheduleCalendar weekStart={iso(start)} appts={appts} />;
}
