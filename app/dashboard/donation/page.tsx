import { requireAuth } from "@/lib/auth";
import { getCatalog } from "@/lib/queries";
import DonationForm from "./DonationForm";

export const dynamic = "force-dynamic";

export default async function DonationPage() {
  await requireAuth();
  const catalog = await getCatalog();
  return <DonationForm catalog={catalog} />;
}
