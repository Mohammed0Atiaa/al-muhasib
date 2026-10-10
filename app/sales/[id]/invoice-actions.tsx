"use client";

import { useState } from "react";
import { getWhatsappLink } from "@/lib/actions/share";

export default function InvoiceActions({ invoiceId }: { invoiceId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function whatsapp() {
    setBusy(true);
    setError("");
    const res = await getWhatsappLink(invoiceId);
    setBusy(false);
    if (res.ok) window.location.assign(res.url);
    else setError(res.error);
  }

  const btn = "rounded-lg border px-4 py-2 text-sm font-medium";
  return (
    <div className="flex flex-wrap items-center gap-2" dir="rtl">
      <a href={`/sales/${invoiceId}/print?auto=1`} target="_blank" className={btn}>
        طباعة
      </a>
      <a href={`/sales/${invoiceId}/print?auto=1&pdf=1`} target="_blank" className={btn}>
        تحميل PDF
      </a>
      <button
        type="button"
        onClick={whatsapp}
        disabled={busy}
        className={`${btn} border-green-600 text-green-700 disabled:opacity-50`}
      >
        {busy ? "جاري التجهيز..." : "إرسال واتساب"}
      </button>
      {error && <span className="text-sm text-red-600">{error}</span>}
    </div>
  );
}
