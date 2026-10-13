"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const DEFAULT_EXPENSE_CATEGORIES = [
  { id: "rent", name: "إيجار" },
  { id: "salaries", name: "رواتب ومستحقات" },
  { id: "employee_advance", name: "سلفة / عهدة موظف" },
  { id: "electricity", name: "رسوم كهرباء وماء" },
  { id: "fuel", name: "بنزين ونقليات" },
  { id: "supplies", name: "نثريات وشياكة" },
  { id: "maintenance", name: "صيانة وتشغيل" },
];

export default function NewPaymentVoucherPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [paidTo, setPaidTo] = useState("");
  const [category, setCategory] = useState("rent");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("CASH");
  const [notes, setNotes] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paidTo || !amount || Number(amount) <= 0) {
      setError("يرجى ملء جميع الحقول المطلوبة بمبالغ صحيحة");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/expenses/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paidTo,
          expenseCategoryId: category,
          amount: parseFloat(amount),
          paymentMethod: method,
          notes,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "حدث خطأ أثناء حفظ سند الصرف");
      }

      // استخراج المعرّف بدقة سواء كان داخل voucher أو كقيمة مباشرة منعاً للـ 404
      const voucherId = data.voucher?.id || data.id;

      if (!voucherId) {
        throw new Error("لم يتم استرجاع رقم السند بنجاح من الخادم");
      }

      router.push(`/expenses/payments/${voucherId}?done=1`);
    } catch (err: any) {
      setError(err.message || "فشل الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main dir="rtl" className="mx-auto max-w-2xl p-4 md:p-6 my-8">
      <div className="bg-white border rounded-2xl shadow-sm p-6 space-y-6">
        <div className="flex justify-between items-center border-b pb-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">إصدار سند صرف جديد</h1>
            <p className="text-xs text-gray-500 mt-1">
              قم بتعبئة بيانات السند لاقتطاعه وتوثيقه محاسبياً
            </p>
          </div>
          <Link
            href="/dashboard"
            className="text-xs border px-3 py-1.5 rounded-lg text-gray-600 hover:bg-gray-50"
          >
            إلغاء وعودة
          </Link>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-800">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              المصروف له / الجهة المستفيدة <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="مثال: اسم الموظف، المالك، الشركة المستفيدة..."
              value={paidTo}
              onChange={(e) => setPaidTo(e.target.value)}
              className="w-full rounded-xl border border-gray-300 p-2.5 text-sm focus:border-purple-600 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                بند المصروف / الحساب <span className="text-red-500">*</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl border border-gray-300 p-2.5 text-sm focus:border-purple-600 focus:outline-none bg-white"
              >
                {DEFAULT_EXPENSE_CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                طريقة الدفع <span className="text-red-500">*</span>
              </label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="w-full rounded-xl border border-gray-300 p-2.5 text-sm focus:border-purple-600 focus:outline-none bg-white"
              >
                <option value="CASH">كاش (نقدي)</option>
                <option value="KNET">كي نت (KNET)</option>
                <option value="CARD">بطاقة ائتمانية</option>
                <option value="TRANSFER">تحويل بنكي</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              المبلغ المصروف <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="any"
              required
              placeholder="0.000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-xl border border-gray-300 p-2.5 text-sm font-bold text-purple-800 focus:border-purple-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              البيان / سبب الصرف التفصيلي
            </label>
            <textarea
              rows={3}
              placeholder="تفاصيل البيان هنا..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-xl border border-gray-300 p-2.5 text-sm focus:border-purple-600 focus:outline-none"
            />
          </div>

          <div className="pt-3">
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-purple-600 py-3 text-sm font-bold text-white hover:bg-purple-700 transition disabled:opacity-50"
            >
              {loading ? "جاري حفظ سند الصرف..." : "💾 حفظ إصدار سند الصرف"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
