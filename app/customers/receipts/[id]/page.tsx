import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getMembership } from "@/lib/company";
import { loadReceiptSheet } from "@/lib/receipt-data";
import ReceiptSheet from "@/components/receipt-sheet";
import ReceiptActions from "@/components/receipt-actions";

export const dynamic = "force-dynamic";

export default async function ReceiptPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ done?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await getCurrentUser();
  const { companyId } = await getMembership(user.id);

  const data = await loadReceiptSheet({ id, companyId });
  if (!data) notFound();

  return (
    <div className="min-h-screen bg-gray-100 p-3 print:bg-white print:p-0">
      <div dir="rtl" className="mx-auto mb-3 max-w-[210mm] space-y-3 print:hidden">
        {sp.done && (
          <div className="rounded-xl border border-green-200 bg-green-50 p-3 font-bold text-green-800">
            تم حفظ سند القبض رقم {data.number}
          </div>
        )}
        <ReceiptActions receiptId={id} />
      </div>
      <ReceiptSheet d={data} />
    </div>
  );
}
