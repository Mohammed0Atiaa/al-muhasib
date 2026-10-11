"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  deleteEmployee,
  toggleEmployeeStatus,
  updateEmployeeRole,
} from "@/lib/actions/team";

export default function TeamActions({
  membershipId,
  currentRole,
  status,
  isOwner,
  isMe,
}: {
  membershipId: string;
  currentRole: string;
  status: string;
  isOwner: boolean;
  isMe: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const suspended = status === "SUSPENDED";

  async function handleRoleChange(newRole: string) {
    if (isOwner) return;
    setBusy(true);
    const res = await updateEmployeeRole(membershipId, newRole);
    setBusy(false);
    if (res.ok) router.refresh();
    else alert(res.error);
  }

  async function handleToggleStatus() {
    if (isOwner || isMe) return;
    setBusy(true);
    const res = await toggleEmployeeStatus(membershipId);
    setBusy(false);
    if (res.ok) router.refresh();
    else alert(res.error);
  }

  async function handleDelete() {
    if (isOwner || isMe) return;
    if (!confirm("هل أنت متأكد من حذف هذا الموظف نهائياً؟ سيتم تحرير إيميله.")) return;
    setBusy(true);
    const res = await deleteEmployee(membershipId);
    setBusy(false);
    if (res.ok) router.refresh();
    else alert(res.error);
  }

  if (isOwner) {
    return <span className="text-xs text-gray-400">مالك الحساب الرئيسي</span>;
  }

  const btn = "rounded-lg border px-2.5 py-1 text-xs font-medium disabled:opacity-50";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        disabled={busy || isMe}
        value={currentRole}
        onChange={(e) => handleRoleChange(e.target.value)}
        className="rounded-lg border bg-white px-2 py-1 text-xs text-gray-700 disabled:opacity-50"
      >
        <option value="MANAGER">مدير</option>
        <option value="ACCOUNTANT">محاسب</option>
        <option value="STOREKEEPER">مسؤول مخزن</option>
        <option value="CASHIER">بائع / كاشير</option>
      </select>

      {!isMe && (
        <>
          <button
            type="button"
            disabled={busy}
            onClick={handleToggleStatus}
            className={`${btn} border-amber-400 text-amber-700 hover:bg-amber-50`}
          >
            {suspended ? "تفعيل" : "تعليق"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={handleDelete}
            className={`${btn} border-red-400 text-red-700 hover:bg-red-50`}
          >
            حذف
          </button>
        </>
      )}
    </div>
  );
}
