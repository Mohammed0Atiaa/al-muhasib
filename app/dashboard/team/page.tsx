import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import TeamActions from "./team-actions";

export const dynamic = "force-dynamic";

const ROLE_NAMES: Record<string, string> = {
  OWNER: "مالك الشركة",
  MANAGER: "مدير",
  ACCOUNTANT: "محاسب",
  STOREKEEPER: "مسؤول مخزن",
  CASHIER: "بائع / كاشير",
};

export default async function TeamPage() {
  const user = await getCurrentUser();
  const myMembership = await prisma.membership.findFirst({
    where: { userId: user.id },
  });

  if (!myMembership) {
    return <div className="p-6 text-center">لا توجد صلاحية مرتبطة بهذا الحساب.</div>;
  }

  // جلب موظفي نفس الشركة حصراً
  const members = await prisma.membership.findMany({
    where: { companyId: myMembership.companyId },
    orderBy: { createdAt: "desc" },
  });

  // جلب بيانات المستخدمين من Stack Auth لعرض الإيميلات والأسماء
  // بما أننا نحتاج لبيانات الدخول، سنعرض الـ userId أو نجلب ما توفر
  return (
    <div className="mx-auto max-w-5xl p-4 md:p-6" dir="rtl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">إدارة فريق العمل</h1>
          <p className="text-sm text-gray-500">إضافة الموظفين وتحديد صلاحياتهم ووظائفهم داخل الشركة</p>
        </div>
        <Link
          href="/dashboard/team/new"
          className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-purple-700"
        >
          + إضافة موظف جديد
        </Link>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 border-b">
            <tr>
              <th className="p-3 text-start">الموظف / المعرف</th>
              <th className="p-3 text-start">الوظيفة (الصلاحية)</th>
              <th className="p-3 text-start">الهاتف والجنسية</th>
              <th className="p-3 text-start">الحالة</th>
              <th className="p-3 text-start">الإجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {members.map((m) => {
              const isMe = m.userId === user.id;
              return (
                <tr key={m.id} className={m.status === "SUSPENDED" ? "bg-amber-50/50" : ""}>
                  <td className="p-3">
                    <div className="font-bold text-gray-900">
                      {isMe ? "أنت (الحساب الحالي)" : `مستخدم نظام`}
                    </div>
                    <div className="text-xs text-gray-400 font-mono" dir="ltr">
                      {m.userId.substring(0, 16)}...
                    </div>
                  </td>
                  <td className="p-3">
                    <span className="font-medium text-purple-700 bg-purple-50 px-2.5 py-1 rounded-md text-xs">
                      {ROLE_NAMES[m.role] || m.role}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="text-gray-800" dir="ltr">{m.phone || "-"}</div>
                    <div className="text-xs text-gray-500">{m.nationality || "غير محدد"}</div>
                  </td>
                  <td className="p-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        m.status === "SUSPENDED"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-green-100 text-green-700"
                      }`}
                    >
                      {m.status === "SUSPENDED" ? "معلّق" : "نشط"}
                    </span>
                  </td>
                  <td className="p-3">
                    <TeamActions
                      membershipId={m.id}
                      currentRole={m.role}
                      status={m.status}
                      isOwner={m.role === "OWNER"}
                      isMe={isMe}
                    />
                  </td>
                </tr>
              );
            })}
            {members.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-gray-400">
                  لا توجد موظفين مضافين حتى الآن
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
