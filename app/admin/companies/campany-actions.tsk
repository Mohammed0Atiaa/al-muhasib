"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  deleteCompany,
  resetOwnerPassword,
  setCompanyStatus,
} from "@/lib/actions/admin";

export default function CompanyActions({
  id,
  name,
  status,
}: {
  id: string;
  name: string;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const suspended = status === "SUSPENDED";

  async function toggle() {
    const msg = suspended
      ? `تفعيل شركة "${name}"؟`
      : `تعليق شركة "${name}"؟ لن يستطيع أحد من موظفيها الدخول.`;
    if (!confirm(msg)) return;
    setBusy(true);
    const res = await setCompanyStatus(id, suspended ? "ACTIVE" : "SUSPENDED");
    setBusy(false);
    if (res.ok) router.refresh();
    else alert(res.error);
  }

  async function reset() {
    if (!confirm(`إعادة تعيين كلمة سر مدير "${name}"؟`)) return;
    setBusy(true);
    const res = await resetOwnerPassword(id);
    setBusy(false);
    if (res.ok && res.password) {
      try {
        await navigator.clipboard.writeText(res.password);
      } catch {}
      alert(`كلمة السر الجديدة:\n\n${res.password}\n\nانسخها الآن، لن تظهر مرة أخرى.`);
      router.refresh();
    } else if (!res.ok) {
      alert(res.error);
    }
  }

  async function remove() {
    const typed = prompt(`للحذف اكتب اسم الشركة بالضبط:\n${name}`);
    if (typed === null) return;
    setBusy(true);
    const res = await deleteCompany(id, typed);
    setBusy(false);
    if (res.ok) router.refresh();
    else alert(res.error);
  }

  const btn = "rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-50";
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={busy} onClick={toggle} className={`${btn} border-amber-400 text-amber-700`}>
        {suspended ? "تفعيل" : "تعليق"}
      </button>
      <button type="button" disabled={busy} onClick={reset} className={`${btn} border-blue-400 text-blue-700`}>
        كلمة السر
      </button>
      <button type="button" disabled={busy} onClick={remove} className={`${btn} border-red-400 text-red-700`}>
        حذف
      </button>
    </div>
  );
}
