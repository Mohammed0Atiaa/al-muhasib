"use client";

import { useState } from "react";
import Link from "next/link";
import { createEmployee } from "@/lib/actions/team";

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
function generatePassword() {
  const a = new Uint32Array(12);
  crypto.getRandomValues(a);
  return Array.from(a, (n) => CHARS[n % CHARS.length]).join("");
}

export default function EmployeeForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("CASHIER");
  const [phone, setPhone] = useState("");
  const [nationality, setNationality] = useState("");
  
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);

  async function submit() {
    setError("");
    setSaving(true);
    const res = await createEmployee({ name, email, password, role, phone, nationality });
    setSaving(false);
    if (res.ok) {
      setCreated({ email: email.trim().toLowerCase(), password });
    } else {
      setError(res.error);
    }
  }

  const field = "w-full rounded-lg border px-3 py-2 text-sm";

  if (created) {
    const text = `الإيميل: ${created.email}\nكلمة السر: ${created.password}`;
    return (
      <div className="space-y-4 rounded-xl border border-green-200 bg-green-50 p-6 text-right">
        <p className="font-bold text-green-800 text-base">تم إنشاء حساب الموظف بنجاح!</p>
        <pre dir="ltr" className="whitespace-pre-wrap rounded-lg bg-white p-4 text-sm font-mono border">{text}</pre>
        <p className="text-xs text-gray-600">انسخ هذه البيانات وأعطها للموظف لتسجيل الدخول. كلمة السر لن تظهر مرة أخرى.</p>
        <div className="flex gap-3">
          <button
            type="button"
            className="rounded-lg border bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50"
            onClick={() => navigator.clipboard.writeText(text).catch(() => {})}
          >
            نسخ البيانات
          </button>
          <Link href="/dashboard/team" className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700">
            العودة للموظفين
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border bg-white p-6 shadow-sm">
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">اسم الموظف <span className="text-red-500">*</span></label>
        <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: أحمد محمد" />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">البريد الإلكتروني (اسم الدخول) <span className="text-red-500">*</span></label>
        <input type="email" dir="ltr" className={field} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="employee@company.com" />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">كلمة السر (6 أحرف على الأقل) <span className="text-red-500">*</span></label>
        <div className="flex gap-2">
          <input dir="ltr" className={field} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="أدخل كلمة السر أو قم بالتوليد" />
          <button
            type="button"
            className="whitespace-nowrap rounded-lg border px-3 text-xs font-medium text-purple-600 hover:bg-purple-50"
            onClick={() => setPassword(generatePassword())}
          >
            توليد عشوائي
          </button>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">الوظيفة / الصلاحية <span className="text-red-500">*</span></label>
        <select className={field} value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="CASHIER">بائع / كاشير</option>
          <option value="ACCOUNTANT">محاسب</option>
          <option value="STOREKEEPER">مسؤول مخزن</option>
          <option value="MANAGER">مدير</option>
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">رقم الهاتف (اختياري)</label>
        <input dir="ltr" className={field} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+965 ..." />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">الجنسية (اختياري)</label>
        <input className={field} value="كويتي" disabled className={`${field} bg-gray-100 cursor-not-allowed`} /> {/* يمكنك جعلها حقل نصي حر كما ترغب */}
      </div>

      {/* أو بدلاً من النص الثابت للجنسية، نجعله حقل نصي اختياري حر */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">الجنسية (اختياري)</label>
        <input className={field} value={nationality} onChange={(e) => setNationality(e.target.value)} placeholder="مثال: مصري، كويتي، هندي..." />
      </div>

      {error && <p className="text-sm text-red-600 font-medium">{error}</p>}

      <button
        type="button"
        disabled={saving || !name || !email || !password}
        onClick={submit}
        className="w-full rounded-lg bg-purple-600 py-3 text-sm font-semibold text-white shadow hover:bg-purple-700 disabled:opacity-50"
      >
        {saving ? "جاري إنشاء الموظف..." : "حفظ وإنشاء الموظف"}
      </button>
    </div>
  );
}
