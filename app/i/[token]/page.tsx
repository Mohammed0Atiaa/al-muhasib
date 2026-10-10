import { notFound } from "next/navigation";
import { loadInvoiceSheet } from "@/lib/invoice-data";
import InvoiceSheet from "@/components/invoice-sheet";
import PrintBar from "@/components/print-bar";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function PublicInvoicePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!token || token.length < 20) notFound();

  const data = await loadInvoiceSheet({ shareToken: token });
  if (!data) notFound();

  return (
    <div className="min-h-screen bg-gray-100 py-4 print:bg-white print:py-0">
      <PrintBar auto={false} pdf={false} />
      <InvoiceSheet d={{ ...data, customerPhone: null }} />
    </div>
  );
}
