"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Edit, ArrowRight, Save } from "lucide-react";
import Link from "next/link";

export default function EditCustomerPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    async function loadCustomer() {
      try {
        const res = await fetch(`/api/customers?id=${params.id}`);
        const data = await res.json();
        if (data.customer) {
          setForm({
            name: data.customer.name || "",
            phone: data.customer.phone || "",
            phone2: data.customer.phone2 || "",
            email: data.customer.email || "",
            address: data.customer.address || "",
            notes: data.customer.notes || "",
          });
        }
      } catch (err) {
        setError("فشل تحميل بيانات العميل");
      } finally {
        setLoading(false);
      }
    }
    loadCustomer();
  }, [params.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const res = await fetch(`/api/customers/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        router.push("/customers");
      } else {
        setError("حدث خطأ أثناء حفظ التعديلات");
      }
    } catch (err) {
      setError("فشل الاتصال بالخادم");
    } finally {
      setSaving(false);
    }
  };

  const fieldClass = "w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:border-purple-500 focus:outline-none";

  if (loading) return <div className="p-8 text-center text-gray-500" dir="rtl">جاري التحميل...</div>;

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
            <Edit className="w-7 h-7 text-purple-600" />
            تعديل بيانات العميل
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">تحديث معلومات التواصل والعنوان</p>
        </div>
      </div>

      <div className="max-w-2xl bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        {error && <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">اسم العميل بالكامل</label>
            <input
              type="text"
              className={fieldClass}
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
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">رقم هاتف إضافي</label>
              <input
                type="text"
                className={fieldClass}
                value={form.phone2}
                onChange={(e) => setForm({ ...form, phone2: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">البريد الإلكتروني</label>
            <input
              type="email"
              className={fieldClass}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">العنوان بالتفصيل</label>
            <input
              type="text"
              className={fieldClass}
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">ملاحظات / بيان خاص</label>
            <textarea
              rows={3}
              className={fieldClass}
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
            {saving ? "جاري التعديل..." : "حفظ التعديلات"}
          </button>
        </form>
      </div>
    </main>
  );
}
