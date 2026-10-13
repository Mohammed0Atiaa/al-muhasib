"use client";

import React from "react";
import Link from "next/link";

interface PaymentActionsProps {
  paymentId: string;
  voucherNumber?: string;
  amount?: number;
}

export default function PaymentActions({
  paymentId,
  voucherNumber = "",
  amount = 0,
}: PaymentActionsProps) {
  const btn = "rounded-lg border bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50 transition";

  // إجراء إرسال واتساب برابط السند والتفاصيل مثل بقية النظام
  const handleWhatsAppShare = () => {
    const currentUrl = window.location.href;
    const message = `مرحباً، تم إصدار سند صرف رقم (${voucherNumber}) بمبلغ (${amount}).\nيمكنك معاينة السند عبر الرابط التالي:\n${currentUrl}`;
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/?text=${encodedMessage}`;
    window.open(whatsappUrl, "_blank");
  };

  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      {/* زر الطباعة المباشر بنفس نمط سند القبض والفواتير */}
      <a
        href={`/expenses/payments/${paymentId}/print?auto=1`}
        target="_blank"
        className={btn}
      >
        طباعة
      </a>

      {/* زر تحميل PDF */}
      <a
        href={`/expenses/payments/${paymentId}/print?auto=1&pdf=1`}
        target="_blank"
        className={btn}
      >
        تحميل PDF
      </a>

      {/* زر إرسال واتساب */}
      <button
        type="button"
        onClick={handleWhatsAppShare}
        className={`${btn} border-green-600 text-green-700 hover:bg-green-50`}
      >
        إرسال واتساب
      </button>

      {/* أزرار التنقل السريعة للإلغاء والعودة أو الإصدار الجديد */}
      <Link
        href="/expenses/payments/new"
        className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 transition"
      >
        سند جديد
      </Link>
      <Link href="/dashboard" className={btn}>
        الرئيسية
      </Link>
    </div>
  );
}
