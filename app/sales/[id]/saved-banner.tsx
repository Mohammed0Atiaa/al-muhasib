"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function SavedBanner({ number }: { number: string }) {
  const done = useSearchParams().get("done");
  if (done !== "created" && done !== "voided") return null;
  const voided = done === "voided";

  return (
    <div
      dir="rtl"
      className={`mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 print:hidden ${
        voided
          ? "border-red-200 bg-red-50 text-red-800"
          : "border-green-200 bg-green-50 text-green-800"
      }`}
    >
      <p className="font-bold">
        {voided ? `تم إلغاء الفاتورة رقم ${number}` : `تم حفظ الفاتورة رقم ${number}`}
      </p>
      <Link
        href="/sales/new"
        className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white"
      >
        فاتورة جديدة
      </Link>
    </div>
  );
}
