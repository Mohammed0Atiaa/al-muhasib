import { redirect } from "next/navigation";
import { prisma } from "./prisma";
import { stackServerApp } from "@/stack/server";
import { can } from "./permissions";

/** خطأ وصول (401/403) تتعامل معه الـ API و الـ Server Actions برسالة عربية واضحة */
export class AccessError extends Error {
  constructor(public status: 401 | 403, message: string) {
    super(message);
  }
}

async function loadMemberships(userId: string) {
  return prisma.membership.findMany({
    where: { userId },
    include: { company: true },
    orderBy: { createdAt: "asc" }, // اختيار حتمي بدل findFirst العشوائي
  });
}

type MembershipWithCompany = Awaited<ReturnType<typeof loadMemberships>>[number];

type Resolved =
  | { kind: "ok"; membership: MembershipWithCompany }
  | { kind: "admin" }
  | { kind: "none" }
  | { kind: "member_suspended" }
  | { kind: "company_inactive" };

/**
 * يحدد العضوية الفعّالة للمستخدم:
 * - يتجاهل العضويات المعلّقة (SUSPENDED) والشركات غير النشطة.
 * - يختار أقدم عضوية فعّالة بشكل حتمي.
 */
async function resolveMembership(userId: string): Promise<Resolved> {
  const all = await loadMemberships(userId);

  if (all.length === 0) {
    const admin = await prisma.platformAdmin.findUnique({ where: { userId } });
    return admin ? { kind: "admin" } : { kind: "none" };
  }

  const active = all.filter((m) => m.status === "ACTIVE");
  if (active.length === 0) return { kind: "member_suspended" };

  const usable = active.find((m) => m.company.status === "ACTIVE");
  if (!usable) return { kind: "company_inactive" };

  return { kind: "ok", membership: usable };
}

/**
 * للصفحات (Server Components): يعيد التوجيه عند الحالات غير المسموحة.
 * لا تستدعها داخل try/catch لأن redirect يعمل برمي استثناء خاص.
 */
export async function getMembership(userId: string) {
  const r = await resolveMembership(userId);
  if (r.kind === "ok") return r.membership;
  if (r.kind === "admin") redirect("/admin");
  if (r.kind === "member_suspended" || r.kind === "company_inactive") redirect("/suspended");
  throw new Error("This user does not belong to any company.");
}

/**
 * للـ Server Actions و API Routes: مصادقة ← عضوية فعّالة ← فحص الصلاحية.
 * يرمي AccessError ولا يعيد التوجيه، فيمكن استدعاؤها داخل try/catch بأمان.
 */
export async function requireMember(permission?: string) {
  const user = await stackServerApp.getUser();
  if (!user) throw new AccessError(401, "يجب تسجيل الدخول أولًا");

  const r = await resolveMembership(user.id);
  if (r.kind === "member_suspended") throw new AccessError(403, "تم تعليق حسابك، تواصل مع مدير الشركة");
  if (r.kind === "company_inactive") throw new AccessError(403, "الشركة غير نشطة");
  if (r.kind !== "ok") throw new AccessError(403, "ليس لديك عضوية في أي شركة");

  const { membership } = r;
  if (permission && !can(membership.role, permission)) {
    throw new AccessError(403, "ليس لديك صلاحية لتنفيذ هذا الإجراء");
  }

  return { user, membership, companyId: membership.companyId };
}
