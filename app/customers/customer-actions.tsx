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
      : "هل أنت تأكد من نقل العميل إلى القائمة السوداء (الحظر)؟";

    if (!confirm(confirmMsg)) return;

    await fetch(`/api/customers/${customer.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isBlacklisted: !customer.isBlacklisted }),
    });

    router.refresh();
  };

  // حذف العميل
  const handleDelete = async () => {
    if (!confirm("هل أنت متأكد من حذف هذا العميل؟ سيبقى سجل فواتيره ومشترياته محفوظاً في النظام ولن يتم حذفه.")) return;

    const res = await fetch(`/api/customers/${customer.id}`, {
      method: "DELETE",
    });

    if (res.ok) {
      router.refresh();
    } else {
      alert("حدث خطأ أثناء حذف العميل");
    }
  };

  return (
    <div className="flex items-center justify-center gap-2">
      {/* 1. تفاصيل */}
      <Link
        href={`/customers/${customer.id}`}
        title="عرض التفاصيل وكشف الحساب"
        className="p-1.5 text-purple-600 bg-purple-50 rounded-md hover:bg-purple-100"
      >
        <Eye className="w-4 h-4" />
      </Link>

      {/* 2. تعديل */}
      <Link
        href={`/customers/${customer.id}/edit`}
        title="تعديل البيانات"
        className="p-1.5 text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100"
      >
        <Edit className="w-4 h-4" />
      </Link>

      {/* 3. حظر / قائمة سوداء */}
      <button
        onClick={toggleBlacklist}
        title={customer.isBlacklisted ? "إلغاء الحظر" : "حظر العميل (قائمة سوداء)"}
        className={`p-1.5 rounded-md ${
          customer.isBlacklisted
            ? "text-green-600 bg-green-50 hover:bg-green-100"
            : "text-amber-600 bg-amber-50 hover:bg-amber-100"
        }`}
      >
        <ShieldAlert className="w-4 h-4" />
      </button>

      {/* 4. حذف */}
      <button
        onClick={handleDelete}
        title="حذف العميل"
        className="p-1.5 text-red-600 bg-red-50 rounded-md hover:bg-red-100"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}
