"use client";

import { useState } from "react";
import Link from "next/link";
import { getReceiptWhatsappLink } from "@/lib/actions/receipt-share";

export default function ReceiptActions({ receiptId }: { receiptId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function whatsapp() {
    setBusy(true);
    setError("");
    const res = await getReceiptWhatsappLink(receiptId);
    setBusy(false);
    if (res.ok) window.location.assign(res.url);
    else setError(res.error);
  }

  const btn = "rounded-lg border bg-white px-4 py-2 text-sm font-medium";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <a href={`/customers/receipts/${receiptId}/print?auto=1`} target="_blank" className={btn}>
        طباعة
      </a>
      <a href={`/customers/receipts/${receiptId}/print?auto=1&pdf=1`} target="_blank" className={btn}>
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
      <Link href="/customers/receipts/new" className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white">
        سند جديد
      </Link>
      <Link href="/customers" className={btn}>
        العملاء
      </Link>
      {error && <span className="text-sm text-red-600">{error}</span>}
    </div>
  );
}
