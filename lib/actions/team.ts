"use server";

import { randomInt } from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { stackServerApp } from "@/stack/server";
import { prisma } from "../prisma";
import { requireMember, AccessError } from "../company";
import { ASSIGNABLE_ROLES, MANAGER_MANAGEABLE_ROLES } from "../permissions";

class UserError extends Error {}

type Result =
  | { ok: true; id?: string; password?: string }
  | { ok: false; error: string };

const RoleSchema = z.enum(ASSIGNABLE_ROLES, { message: "اختر وظيفة صحيحة" });

const CreateEmployeeSchema = z.object({
  name: z.string().trim().min(2, "اسم الموظف مطلوب").max(100),
  email: z.string().trim().toLowerCase().email("إيميل غير صحيح"),
  password: z
    .string()
    .min(10, "كلمة السر 10 أحرف على الأقل")
    .max(72, "كلمة السر طويلة جدًا")
    .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), "كلمة السر يجب أن تحتوي حروفًا وأرقامًا"),
  role: RoleSchema,
  phone: z.string().trim().max(30).optional(),
  nationality: z.string().trim().max(60).optional(),
});

function fail(e: unknown): Result {
  if (e instanceof UserError || e instanceof AccessError) return { ok: false, error: e.message };
  console.error(e);
  return { ok: false, error: "حدث خطأ غير متوقع" };
}

/** مصادقة + عضوية فعّالة + صلاحية إدارة الفريق */
async function teamActor() {
  const { user, membership, companyId } = await requireMember("team:manage");
  return { userId: user.id, role: membership.role, companyId };
}

/** المالك فقط يعيّن المديرين؛ المدير يعيّن الأدوار الأدنى فقط */
function assertCanAssign(actorRole: string, role: string) {
  if (actorRole !== "OWNER" && !(MANAGER_MANAGEABLE_ROLES as readonly string[]).includes(role)) {
    throw new UserError("فقط المالك يستطيع تعيين مدير");
  }
}

/** قواعد التحكم في حساب موظف آخر */
function assertCanManageTarget(
  actor: { userId: string; role: string },
  target: { userId: string; role: string }
) {
  if (target.userId === actor.userId) {
    throw new UserError("لا يمكنك تنفيذ هذا الإجراء على حسابك الشخصي");
  }
  if (target.role === "OWNER") {
    throw new UserError("لا يمكن تنفيذ هذا الإجراء على حساب المالك");
  }
  if (actor.role !== "OWNER" && !(MANAGER_MANAGEABLE_ROLES as readonly string[]).includes(target.role)) {
    throw new UserError("فقط المالك يستطيع إدارة حسابات المديرين");
  }
}

async function findTarget(membershipId: string, companyId: string) {
  const target = await prisma.membership.findFirst({ where: { id: membershipId, companyId } });
  if (!target) throw new UserError("الموظف غير موجود");
  return target;
}

type AuditInput = {
  companyId: string;
  userId: string;
  action: string;
  entityId: string;
  reason?: string;
};

async function audit(a: AuditInput) {
  await prisma.auditLog.create({
    data: {
      companyId: a.companyId,
      userId: a.userId,
      action: a.action,
      entityType: "Membership",
      entityId: a.entityId,
      reason: a.reason,
    },
  });
}

function generatePassword(length = 14) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  let out = "";
  for (let i = 0; i < length; i++) out += chars[randomInt(chars.length)];
  // نضمن وجود حرف ورقم
  return /[A-Za-z]/.test(out) && /\d/.test(out) ? out : generatePassword(length);
}

export async function createEmployee(input: unknown): Promise<Result> {
  let createdUserId: string | null = null;
  try {
    const actor = await teamActor();
    const parsed = CreateEmployeeSchema.safeParse(input);
    if (!parsed.success) {
      throw new UserError(parsed.error.issues[0]?.message ?? "بيانات غير صحيحة");
    }
    const d = parsed.data;
    assertCanAssign(actor.role, d.role);

    let newUser;
    try {
      newUser = await stackServerApp.createUser({
        primaryEmail: d.email,
        password: d.password,
        primaryEmailAuthEnabled: true,
        primaryEmailVerified: true,
        displayName: d.name,
      });
    } catch (e) {
      console.error(e);
      throw new UserError("تعذر إنشاء حساب الموظف: البريد الإلكتروني مستخدم مسبقاً");
    }
    createdUserId = newUser.id;

    const membership = await prisma.membership.create({
      data: {
        companyId: actor.companyId,
        userId: newUser.id,
        role: d.role,
        phone: d.phone || null,
        nationality: d.nationality || null,
        status: "ACTIVE",
        mustChangePassword: true,
      },
    });

    await audit({
      companyId: actor.companyId,
      userId: actor.userId,
      action: "EMPLOYEE_CREATED",
      entityId: membership.id,
      reason: `role=${d.role}`,
    });

    revalidatePath("/dashboard/team");
    return { ok: true, id: newUser.id };
  } catch (e) {
    if (createdUserId) {
      try {
        const u = await stackServerApp.getUser(createdUserId);
        await u?.delete();
      } catch (err) {
        console.error(err);
      }
    }
    return fail(e);
  }
}

export async function updateEmployeeRole(membershipId: string, newRole: string): Promise<Result> {
  try {
    const actor = await teamActor();

    const parsedRole = RoleSchema.safeParse(newRole);
    if (!parsedRole.success) throw new UserError("وظيفة غير صحيحة");
    const role = parsedRole.data;

    const target = await findTarget(membershipId, actor.companyId);
    assertCanManageTarget(actor, target);
    assertCanAssign(actor.role, role);

    if (target.role === role) return { ok: true };

    await prisma.membership.update({ where: { id: target.id }, data: { role } });
    await audit({
      companyId: actor.companyId,
      userId: actor.userId,
      action: "EMPLOYEE_ROLE_CHANGED",
      entityId: target.id,
      reason: `${target.role} -> ${role}`,
    });

    revalidatePath("/dashboard/team");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function toggleEmployeeStatus(membershipId: string): Promise<Result> {
  try {
    const actor = await teamActor();
    const target = await findTarget(membershipId, actor.companyId);
    assertCanManageTarget(actor, target);

    const newStatus = target.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    await prisma.membership.update({ where: { id: target.id }, data: { status: newStatus } });
    await audit({
      companyId: actor.companyId,
      userId: actor.userId,
      action: newStatus === "SUSPENDED" ? "EMPLOYEE_SUSPENDED" : "EMPLOYEE_ACTIVATED",
      entityId: target.id,
    });

    revalidatePath("/dashboard/team");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteEmployee(membershipId: string): Promise<Result> {
  try {
    const actor = await teamActor();
    const target = await findTarget(membershipId, actor.companyId);
    assertCanManageTarget(actor, target);

    // أولًا: إزالة العضوية + سجل المراجعة في transaction واحدة
    await prisma.$transaction(async (tx) => {
      await tx.membership.delete({ where: { id: target.id } });
      await tx.auditLog.create({
        data: {
          companyId: actor.companyId,
          userId: actor.userId,
          action: "EMPLOYEE_DELETED",
          entityType: "Membership",
          entityId: target.id,
          reason: `role=${target.role}`,
        },
      });
    });

    // ثانيًا: حذف حساب الدخول (لا يؤثر فشله على أمان الشركة لأن العضوية حُذفت)
    try {
      const u = await stackServerApp.getUser(target.userId);
      await u?.delete();
    } catch (err) {
      console.error(err);
    }

    revalidatePath("/dashboard/team");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function resetEmployeePassword(
  membershipId: string
): Promise<{ ok: true; newPassword: string } | { ok: false; error: string }> {
  try {
    const actor = await teamActor();
    const target = await findTarget(membershipId, actor.companyId);
    assertCanManageTarget(actor, target);

    const newPassword = generatePassword();

    const u = await stackServerApp.getUser(target.userId);
    if (!u) throw new UserError("حساب المستخدم غير موجود في نظام المصادقة");
    await u.update({ password: newPassword });

    await prisma.membership.update({
      where: { id: target.id },
      data: { mustChangePassword: true },
    });
    await audit({
      companyId: actor.companyId,
      userId: actor.userId,
      action: "EMPLOYEE_PASSWORD_RESET",
      entityId: target.id,
    });

    return { ok: true, newPassword };
  } catch (e) {
    if (e instanceof UserError || e instanceof AccessError) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: "حدث خطأ أثناء إعادة تعيين كلمة السر" };
  }
}
