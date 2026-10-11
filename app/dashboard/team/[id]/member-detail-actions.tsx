"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  deleteEmployee,
  toggleEmployeeStatus,
  resetEmployeePassword,
} from "@/lib/actions/team";

export default function MemberDetailActions({
  membershipId,
  isOwner,
  isMe,
  status,
}: {
  membershipId: string;
  isOwner: boolean;
  isMe: boolean;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [newPasswordResult, setNewPasswordResult] = useState<string | null>(null);
  const suspended = status === "SUSPENDED";

  async function handleResetPassword() {
    if (isOwner) return;
    if (!confirm("هل أنت متأكد من إعادة تعيين كلمة المرور لهذا الموظف؟")) return;
    setBusy(true);
    setNewPasswordResult(null);
    const res = await resetEmployeePassword(membershipId);
    setBusy(false);
    if (res.ok) {
      setNewPasswordResult(res.newPassword);
    } else {
      alert(res.error);
    }
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
    if (!confirm("هل أنت متأكد من حذف هذا الموظف نهائياً؟")) return;
    setBusy(true);
    const res = await deleteEmployee(membershipId);
    setBusy(false);
    if (res.ok) {
      router.push("/dashboard/team");
    } else {
      alert(res.error);
    }
  }

  if (isOwner) {
    return <p className="text-xs text-gray-500">هذا الحساب هو المالك الرئيسي ولا يمكن تعديله أو حذفه من هنا.</p>;
  }

  return (
    <div className="space-y-4">
      {newPasswordResult && (
        <div className="rounded-lg bg-green-50 p-4 border border-green-200">
          <p className="text-xs font-bold text-green-800 mb-1">تم تغيير كلمة المرور بنجاح! كلمة المرور الجديدة للموظف:</p>
          <pre dir="ltr" className="bg-white p-2 rounded text-sm font-mono border">{newPasswordResult}</pre>
          <p className="text-xs text-gray-500 mt-1">انسخها وأعطها للموظف، ولن تظهر مرة أخرى.</p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={handleResetPassword}
          className="rounded-lg border border-purple-300 bg-purple-50 px-4 py-2 text-xs font-semibold text-purple-700 hover:bg-purple-100 disabled:opacity-50"
        >
          إعادة تعيين كلمة السر
        </button>

        {!isMe && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={handleToggleStatus}
              className={`rounded-lg border px-4 py-2 text-xs font-semibold disabled:opacity-50 ${
                suspended
                  ? "border-green-300 text-green-700 bg-green-50 hover:bg-green-100"
                  : "border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100"
              }`}
            >
              {suspended ? "تفعيل الحساب" : "تعليق الحساب"}
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={handleDelete}
            className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
            >
              حذف الموظف نهائياً
            </button>
          </>
        )}
      </div>
    </div>
  );
}
