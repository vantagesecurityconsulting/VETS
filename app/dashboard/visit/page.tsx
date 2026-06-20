import { requireAuth } from "@/lib/auth";
import { getCatalog } from "@/lib/queries";
import VisitFlow from "./VisitFlow";

export const dynamic = "force-dynamic";

export default async function VisitPage() {
  await requireAuth();
  const catalog = await getCatalog();
  return <VisitFlow catalog={catalog} />;
}
