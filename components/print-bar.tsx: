"use client";

import { useEffect } from "react";

export default function PrintBar({
  auto,
  pdf,
  backHref,
}: {
  auto: boolean;
  pdf: boolean;
  backHref?: string;
}) {
  useEffect(() => {
    if (!auto) return;
    const t = setTimeout(() => window.print(), 500);
    return () => clearTimeout(t);
  }, [auto]);

  return (
    <div
      dir="rtl"
      className="mx-auto mb-3 flex max-w-[210mm] items-center justify-between gap-2 p-3 print:hidden"
    >
      <p className="text-sm text-gray-600">
        {pdf ? 'في نافذة الطباعة اختر "حفظ بصيغة PDF"' : ""}
      </p>
      <div className="flex gap-2">
        {backHref && (
          <a href={backHref} className="rounded-lg border bg-white px-4 py-2">
            رجوع
          </a>
        )}
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-lg bg-purple-600 px-4 py-2 text-white"
        >
          طباعة / PDF
        </button>
      </div>
    </div>
  );
}
