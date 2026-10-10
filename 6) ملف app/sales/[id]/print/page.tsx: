import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getMembership } from "@/lib/company";
import { loadInvoiceSheet } from "@/lib/invoice-data";
import InvoiceSheet from "@/components/invoice-sheet";
import PrintBar from "@/components/print-bar";

export const dynamic = "force-dynamic";

export default async function PrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ auto?: string; pdf?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await getCurrentUser();
  const { companyId } = await getMembership(user.id);

  const data = await loadInvoiceSheet({ id, companyId });
  if (!data) notFound();

  return (
    <div className="min-h-screen bg-gray-100 py-4 print:bg-white print:py-0">
      <PrintBar auto={!!sp.auto} pdf={!!sp.pdf} backHref={`/sales/${id}`} />
      <InvoiceSheet d={data} />
    </div>
  );
}
