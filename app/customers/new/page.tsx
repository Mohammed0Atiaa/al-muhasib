"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, ArrowRight, Save } from "lucide-react";
import Link from "next/link";

export default function NewCustomerPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "",
    phone: "",
    phone2: "",
    email: "",
    address: "",
    notes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("يرجى إدخال اسم العميل");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (res.ok && data.customer) {
        router.push("/customers");
      } else {
        setError(data.error || "حدث خطأ أثناء حفظ بيانات العميل");
      }
    } catch (err: any) {
      setError("فشل الاتصال بالخادم");
    } finally {
      setSaving(false);
    }
  };

  const fieldClass = "w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:border-purple-500 focus:outline-none";

  return (
    <main dir="rtl">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/customers"
          className="p-2 text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
        >
          <ArrowRight className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <UserPlus className="w-7 h-7 text-purple-600" />
            تسجيل عميل جديد
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">أدخل البيانات الأساسية لإضافة العميل في النظام</p>
        </div>
      </div>

      <div className="max-w-2xl bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        {error && <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">اسم العميل بالكامل *</label>
            <input
              type="text"
              className={fieldClass}
              placeholder="أدخل اسم العميل..."
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">رقم الهاتف الرئيسي</label>
              <input
                type="text"
                className={fieldClass}
                placeholder="مثال: 90000000"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">رقم هاتف إضافي (اختياري)</label>
              <input
                type="text"
                className={fieldClass}
                placeholder="رقم أخر للتواصل..."
                value={form.phone2}
                onChange={(e) => setForm({ ...form, phone2: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">البريد الإلكتروني (اختياري)</label>
            <input
              type="email"
              className={fieldClass}
              placeholder="example@domain.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">العنوان بالتفصيل</label>
            <input
              type="text"
              className={fieldClass}
              placeholder="المنطقة، الشارع، قطعة، المبنـى..."
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">ملاحظات / بيان خاص بالعميل</label>
            <textarea
              rows={3}
              className={fieldClass}
              placeholder="أي ملاحظات عامة تخص العميل..."
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-lg disabled:opacity-50 transition mt-6"
          >
            <Save className="w-5 h-5" />
            {saving ? "جاري الحفظ..." : "حفظ بيانات العميل"}
          </button>
        </form>
      </div>
    </main>
  );
}
