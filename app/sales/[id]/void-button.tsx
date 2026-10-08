"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { voidInvoice } from "../actions";

interface VoidInvoiceButtonProps {
  invoiceId: string;
}

export default function VoidInvoiceButton({ invoiceId }: VoidInvoiceButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleVoid = async () => {
    if (!reason.trim()) {
      alert("يرجى إدخال سبب الإلغاء");
      return;
    }

    setIsLoading(true);
    try {
      const res = await voidInvoice(invoiceId, reason);

      if (res && res.success) {
        alert("تم إلغاء الفاتورة بنجاح وإعادة البضاعة إلى المخزن.");
        setIsOpen(false);
        setReason("");
        // إعادة تحميل بيانات الصفحة فوراً لتنعكس الحالة والمخزن
        router.refresh();
      } else {
        alert(res?.error || "حدث خطأ أثناء إلغاء الفاتورة");
      }
    } catch (err: any) {
      alert("حدث خطأ في الاتصال بالخادم: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition flex items-center gap-2 text-sm shadow-sm"
      >
        <span>🚫</span>
        <span>إلغاء الفاتورة بالكامل</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-100" dir="rtl">
            <h3 className="text-xl font-bold text-gray-900 mb-2">تأكيد إلغاء الفاتورة</h3>
            <p className="text-sm text-gray-500 mb-4">
              سيتم تغيير حالة الفاتورة إلى ملغاة، وإعادة كافة الأصناف تلقائياً إلى المخزن.
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                سبب الإلغاء <span className="text-red-500">*</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="اكتب سبب إلغاء الفاتورة هنا..."
                rows={3}
                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-red-500 outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                disabled={isLoading}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition"
              >
                إلغاء الأمر
              </button>
              <button
                type="button"
                onClick={handleVoid}
                disabled={isLoading}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition flex items-center gap-2"
              >
                {isLoading ? "جاري الإلغاء..." : "تأكيد الإلغاء"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
