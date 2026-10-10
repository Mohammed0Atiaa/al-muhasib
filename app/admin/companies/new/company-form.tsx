"use client";

import { useState } from "react";
import Link from "next/link";
import { createCompany } from "@/lib/actions/admin";
import { COUNTRIES } from "@/lib/countries";

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
function generate() {
  const a = new Uint32Array(14);
  crypto.getRandomValues(a);
  return Array.from(a, (n) => CHARS[n % CHARS.length]).join("");
}

export default function CompanyForm() {
  const [name, setName] = useState("");
  const [country, setCountry] = useState("الكويت");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);

  async function submit() {
    setError("");
    setSaving(true);
    const res = await createCompany({ name, country, email, password, phone, address });
    setSaving(false);
    if (res.ok) setCreated({ email: email.trim().toLowerCase(), password });
    else setError(res.error);
  }

  const field = "w-full rounded-lg border px-3 py-2";

  if (created) {
    const text = `الإيميل: ${created.email}\nكلمة السر: ${created.password}`;
    return (
      <div className="space-y-3 rounded-xl border border-green-200 bg-green-50 p-4">
        <p className="font-bold text-green-800">تم إنشاء الشركة. بيانات دخول المدير:</p>
        <pre dir="ltr" className="whitespace-pre-wrap rounded bg-white p-3 text-sm">{text}</pre>
        <p className="text-xs text-gray-600">انسخ البيانات الآن وسلّمها للمدير. كلمة السر لن تظهر مرة أخرى.</p>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-lg border bg-white px-4 py-2 text-sm"
            onClick={() => navigator.clipboard.writeText(text).catch(() => {})}
          >
            نسخ
          </button>
          <Link href="/admin/companies" className="rounded-lg bg-purple-600 px-4 py-2 text-sm text-white">
            رجوع للشركات
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-sm font-medium">اسم الشركة</label>
        <input className={field} value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">البلد (يحدد عملة الشركة)</label>
        <select className={field} value={country} onChange={(e) => setCountry(e.target.value)}>
          {Object.keys(COUNTRIES).map((c) => (
            <option key={c} value={c}>
              {c} ({COUNTRIES[c].currency})
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">إيميل المدير (هو اسم الدخول)</label>
        <input type="email" dir="ltr" className={field} value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">كلمة السر (10 أحرف على الأقل)</label>
        <div className="flex gap-2">
          <input dir="ltr" className={field} value={password} onChange={(e) => setPassword(e.target.value)} />
          <button
            type="button"
            className="whitespace-nowrap rounded-lg border px-3 text-purple-600"
            onClick={() => setPassword(generate())}
          >
            توليد
          </button>
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">رقم الهاتف</label>
        <input dir="ltr" className={field} value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">العنوان</label>
        <input className={field} value={address} onChange={(e) => setAddress(e.target.value)} />
      </div>

      {error && <p className="text-red-600">{error}</p>}

      <button
        type="button"
        disabled={saving}
        onClick={submit}
        className="w-full rounded-lg bg-purple-600 py-3 font-semibold text-white disabled:opacity-50"
      >
        {saving ? "جاري الإنشاء..." : "إنشاء الشركة"}
      </button>
    </div>
  );
}
