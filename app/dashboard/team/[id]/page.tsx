import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getMembership } from "@/lib/company";
import { can } from "@/lib/permissions";
import { stackServerApp } from "@/stack/server";
import MemberDetailActions from "./member-detail-actions";

export const dynamic = "force-dynamic";

const ROLE_NAMES: Record<string, string> = {
  OWNER: "مالك الشركة",
  MANAGER: "مدير",
  ACCOUNTANT: "محاسب",
  STOREKEEPER: "مسؤول مخزن",
  CASHIER: "بائع / كاشير",
};

export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  const myMembership = await getMembership(user.id);

  if (!can(myMembership.role, "team:manage")) {
    return <div className="p-6 text-center">ليس لديك صلاحية.</div>;
  }

  // البحث عن العضو بواسطة الـ membership id داخل نفس الشركة فقط
  const member = await prisma.membership.findFirst({
    where: { id, companyId: myMembership.companyId },
  });

  if (!member) {
    return notFound();
  }

  // جلب إيميل الموظف واسمه من Stack Auth
  let userEmail = "غير متوفر";
  let userName = "مستخدم نظام";
  try {
    const stackUser = await stackServerApp.getUser(member.userId);
    if (stackUser) {
      userEmail = stackUser.primaryEmail || "غير متوفر";
      userName = stackUser.displayName || "مستخدم نظام";
    }
  } catch (e) {
    console.error(e);
  }

  const isMe = member.userId === user.id;

  return (
    <div className="mx-auto max-w-2xl p-4 md:p-6" dir="rtl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">تفاصيل الموظف</h1>
          <p className="text-sm text-gray-500">إدارة بيانات الموظف وصلاحياته وكلمة المرور</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard"
            className="rounded-lg border bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          >
            الرئيسية
          </Link>
          <Link
            href="/dashboard/team"
            className="rounded-lg border bg-white px-3 py-1.5 text-xs font-medium text-purple-600 hover:bg-purple-50"
          >
            رجوع للقائمة
          </Link>
        </div>
      </div>

      <div className="space-y-6 rounded-xl border bg-white p-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border-b pb-3">
            <span className="block text-xs text-gray-400">اسم الموظف</span>
            <span className="font-semibold text-gray-900 text-base">{userName}</span>
          </div>

          <div className="border-b pb-3">
            <span className="block text-xs text-gray-400">البريد الإلكتروني (اسم الدخول)</span>
            <span className="font-mono text-gray-800 text-sm" dir="ltr">{userEmail}</span>
          </div>

          <div className="border-b pb-3">
            <span className="block text-xs text-gray-400">الوظيفة الحالية</span>
            <span className="font-medium text-purple-700 bg-purple-50 px-2.5 py-1 rounded-md text-xs inline-block mt-1">
              {ROLE_NAMES[member.role] || member.role}
            </span>
          </div>

          <div className="border-b pb-3">
            <span className="block text-xs text-gray-400">الحالة</span>
            <span
              className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold mt-1 ${
                member.status === "SUSPENDED"
                  ? "bg-amber-100 text-amber-700"
                  : "bg-green-100 text-green-700"
              }`}
            >
              {member.status === "SUSPENDED" ? "معلّق" : "نشط"}
            </span>
          </div>

          <div className="border-b pb-3">
            <span className="block text-xs text-gray-400">رقم الهاتف</span>
            <span className="font-mono text-gray-800 text-sm" dir="ltr">{member.phone || "غير محدد"}</span>
          </div>

          <div className="border-b pb-3">
            <span className="block text-xs text-gray-400">الجنسية</span>
            <span className="text-gray-800 text-sm">{member.nationality || "غير محددة"}</span>
          </div>
        </div>

        {/* أزرار الإجراءات وإعادة تعيين كلمة السر */}
        <div className="pt-2">
          <h3 className="text-sm font-bold text-gray-800 mb-3">الإجراءات المتاحة للمدير</h3>
          <MemberDetailActions
            membershipId={member.id}
            isOwner={member.role === "OWNER"}
            isMe={isMe}
            status={member.status}
          />
        </div>
      </div>
    </div>
  );
}
