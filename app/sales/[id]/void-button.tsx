"use client";

import { useState } from "react";
import { voidInvoice } from "../actions";

export default function VoidInvoiceButton({ invoiceId }: { invoiceId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const handleVoid = async () => {
    if (!reason.trim()) {
      alert("يرجى كتابة سبب الإلغاء لاستكمال العملية");
      return;
    }

    if (!confirm("هل أنت تأكد من إلغاء هذه الفاتورة وإعادة البضاعة للمخزن؟")) return;

    setLoading(true);
    try {
      await voidInvoice(invoiceId, reason);
      setIsOpen(false);
      alert("تم إلغاء الفاتورة وإعادة البضاعة للمخزن بنجاح");
    } catch (err: any) {
      alert(err.message || "حدث خطأ أثناء إلغاء الفاتورة");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-white bg-red-600 rounded-lg shadow-sm hover:bg-red-700 transition"
      >
        <span>🚫</span>
        <span>إلغاء الفاتورة</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 mb-2">إلغاء الفاتورة الكامل</h3>
            <p className="text-sm text-gray-600 mb-4">
              سيتم تغيير حالة الفاتورة إلى ملغاة وإعادة كافة أصناف الفاتورة تلقائياً إلى المخزن.
            </p>

            <label className="block text-sm font-medium text-gray-700 mb-1">
              سبب الإلغاء:
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="مثال: إرجاع العميل للبضاعة خلال 14 يوم / خطأ في إدخال الأصناف..."
              className="w-full border border-gray-300 rounded-lg p-2.5 text-sm mb-4 focus:ring-2 focus:ring-red-500 outline-none"
              rows={3}
            />

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsOpen(false)}
                disabled={loading}
                className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                تراجع
              </button>
              <button
                onClick={handleVoid}
                disabled={loading}
                className="px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? "جاري الإلغاء..." : "تأكيد الإلغاء"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
