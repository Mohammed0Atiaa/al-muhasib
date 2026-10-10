import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getMembership } from "@/lib/company";
import { loadReceiptSheet } from "@/lib/receipt-data";
import ReceiptSheet from "@/components/receipt-sheet";
import PrintBar from "@/components/print-bar";

export const dynamic = "force-dynamic";

export default async function ReceiptPrintPage({
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

  const data = await loadReceiptSheet({ id, companyId });
  if (!data) notFound();

  return (
    <div className="min-h-screen bg-gray-100 py-4 print:bg-white print:py-0">
      <PrintBar auto={!!sp.auto} pdf={!!sp.pdf} backHref={`/customers/receipts/${id}`} />
      <ReceiptSheet d={data} />
    </div>
  );
}
