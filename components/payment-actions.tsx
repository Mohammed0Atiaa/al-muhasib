"use client";

import React from "react";

interface PaymentActionsProps {
  paymentId: string;
  phoneNumber?: string; // رقم هاتف المستفيد إن وجد للإرسال
  voucherNumber?: string;
  amount?: number;
}

export default function PaymentActions({
  paymentId,
  phoneNumber = "",
  voucherNumber = "",
  amount = 0,
}: PaymentActionsProps) {
  // إجراء الطباعة
  const handlePrint = () => {
    window.print();
  };

  // إجراء إرسال واتساب
  const handleWhatsAppShare = () => {
    const currentUrl = window.location.href;
    const message = `مرحباً، تم إصدار سند صرف رقم (${voucherNumber}) بمبلغ (${amount}) د.ك.\nيمكنك معاينة السند عبر الرابط التالي:\n${currentUrl}`;
    const encodedMessage = encodeURIComponent(message);
    
    // إذا كان هناك رقم هاتف مضاف نرسل له مباشرة، وإلا نفتح الواتساب لاختيار جهة الاتصال
    const cleanPhone = phoneNumber.replace(/[^0-9]/g, "");
    const whatsappUrl = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodedMessage}`
      : `https://wa.me/?text=${encodedMessage}`;

    window.open(whatsappUrl, "_blank");
  };

  return (
    <div className="flex flex-wrap gap-2 print:hidden">
      {/* زر الطباعة وتنزيل PDF */}
      <button
        onClick={handlePrint}
        className="flex items-center gap-1.5 rounded-lg bg-purple-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-purple-700 transition"
      >
        🖨️ طباعة / تنزيل PDF
      </button>

      {/* زر إرسال واتساب */}
      <button
        onClick={handleWhatsAppShare}
        className="flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-green-700 transition"
      >
        📲 إرسال عبر واتساب
      </button>
    </div>
  );
}
