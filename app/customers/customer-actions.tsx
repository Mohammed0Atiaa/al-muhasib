"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, Edit, ShieldAlert, Trash2 } from "lucide-react";

export default function CustomerActions({ customer }: { customer: any }) {
  const router = useRouter();

  // تغيير حالة الحظر (البلاك ليست)
  const toggleBlacklist = async () => {
    const confirmMsg = customer.isBlacklisted
      ? "هل تريد إلغاء حظر هذا العميل؟"
      : "هل أنت متأكد من نقل العميل إلى القائمة السوداء (الحظر)؟";

    if (!confirm(confirmMsg)) return;

    try {
      const res = await fetch(`/api/customers/${customer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isBlacklisted: !customer.isBlacklisted }),
      });

      if (res.ok) {
        router.refresh();
      } else {
        alert("حدث خطأ أثناء تعديل حالة الحظر");
      }
    } catch (err) {
      alert("تعذر الاتصال بالسيرفر");
    }
  };

  // حذف العميل
  const handleDelete = async () => {
    if (
      !confirm(
        "هل أنت متأكد من حذف هذا العميل؟ سيبقى سجل فواتيره ومشترياته محفوظاً في النظام ولن يتم حذفه."
      )
    )
      return;

    try {
      const res = await fetch(`/api/customers/${customer.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        router.refresh();
      } else {
        const errorData = await res.json().catch(() => ({}));
        alert(errorData.message || "حدث خطأ أثناء حذف العميل");
      }
    } catch (err) {
      alert("تعذر الاتصال بالسيرفر");
    }
  };

  return (
    <div className="flex items-center justify-center gap-1.5 whitespace-nowrap min-w-[140px]">
      {/* 1. تفاصيل */}
      <Link
        href={`/customers/${customer.id}`}
        title="عرض التفاصيل وكشف الحساب"
        className="inline-flex items-center justify-center p-2 text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors border border-purple-200"
      >
        <Eye className="w-4 h-4" />
      </Link>

      {/* 2. تعديل */}
      <Link
        href={`/customers/${customer.id}/edit`}
        title="تعديل البيانات"
        className="inline-flex items-center justify-center p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200"
      >
        <Edit className="w-4 h-4" />
      </Link>

      {/* 3. حظر / قائمة سوداء */}
      <button
        type="button"
        onClick={toggleBlacklist}
        title={customer.isBlacklisted ? "إلغاء الحظر" : "حظر العميل (قائمة سوداء)"}
        className={`inline-flex items-center justify-center p-2 rounded-lg transition-colors border ${
          customer.isBlacklisted
            ? "text-green-600 bg-green-50 hover:bg-green-100 border-green-200"
            : "text-amber-600 bg-amber-50 hover:bg-amber-100 border-amber-200"
        }`}
      >
        <ShieldAlert className="w-4 h-4" />
      </button>

      {/* 4. حذف */}
      <button
        type="button"
        onClick={handleDelete}
        title="حذف العميل"
        className="inline-flex items-center justify-center p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors border border-red-200"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}
