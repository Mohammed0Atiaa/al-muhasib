"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import InvoiceActions from "./invoice-actions";

export default function SavedBanner({
  number,
  invoiceId,
}: {
  number: string;
  invoiceId: string;
}) {
  const done = useSearchParams().get("done");
  if (done !== "created" && done !== "voided") return null;
  const voided = done === "voided";

  return (
    <div
      dir="rtl"
      className={`mb-6 rounded-xl border p-4 print:hidden ${
        voided ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50"
      }`}
    >
      <p className={`mb-3 text-lg font-bold ${voided ? "text-red-800" : "text-green-800"}`}>
        {voided ? `تم إلغاء الفاتورة رقم ${number}` : `تم حفظ الفاتورة رقم ${number}`}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <InvoiceActions invoiceId={invoiceId} />
        <Link
          href="/sales/new"
          className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white"
        >
          فاتورة جديدة
        </Link>
      </div>
    </div>
  );
}
