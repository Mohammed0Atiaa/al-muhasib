"use server";

import { randomInt } from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { stackServerApp } from "@/stack/server";
import { getCurrentUser } from "../auth";
import { prisma } from "../prisma";

class UserError extends Error {}

type Result =
  | { ok: true; id?: string; password?: string }
  | { ok: false; error: string };

const CreateEmployeeSchema = z.object({
  name: z.string().trim().min(2, "اسم الموظف مطلوب"),
  email: z.string().trim().toLowerCase().email("إيميل غير صحيح"),
  password: z.string().min(6, "كلمة السر 6 أحرف على الأقل").max(72),
  role: z.enum(["MANAGER", "ACCOUNTANT", "STOREKEEPER", "CASHIER"], {
    errorMap: () => ({ message: "اختر وظيفة صحيحة" }),
  }),
  phone: z.string().trim().optional(),
  nationality: z.string().trim().optional(),
});

function fail(e: unknown): Result {
  if (e instanceof UserError) return { ok: false, error: e.message };
  console.error(e);
  return { ok: false, error: "حدث خطأ غير متوقع" };
}

// دالة مساعدة للتحقق من أن المستخدم مدير للشركة وإحضار companyId الخاص به
async function getMyCompanyMembership() {
  const user = await getCurrentUser();
  const membership = await prisma.membership.findFirst({
    where: { userId: user.id },
    include: { company: true },
  });

  if (!membership || membership.company.status !== "ACTIVE") {
    throw new UserError("غير مسموح أو الشركة غير نشطة");
  }

  // يمكننا السماح للـ OWNER أو MANAGER بإدارة الفريق
  if (membership.role !== "OWNER" && membership.role !== "MANAGER") {
    throw new UserError("ليس لديك صلاحية لإدارة الموظفين");
  }

  return { user, companyId: membership.companyId };
}

export async function createEmployee(input: unknown): Promise<Result> {
  let createdUserId: string | null = null;
  try {
    const { companyId } = await getMyCompanyMembership();
    const parsed = CreateEmployeeSchema.safeParse(input);
    if (!parsed.success) {
      throw new UserError(parsed.error.issues[0]?.message ?? "بيانات غير صحيحة");
    }
    const d = parsed.data;

    // 1. إنشاء حساب الدخول في Stack Auth
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

    // 2. ربط الموظف بالشركة في جدول Membership
    await prisma.membership.create({
      data: {
        companyId: companyId,
        userId: newUser.id,
        role: d.role,
        phone: d.phone || null,
        nationality: d.nationality || null,
        status: "ACTIVE",
        mustChangePassword: true, // يفضل أن يغير كلمة السر عند الدخول لأول مرة
      },
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

export async function updateEmployeeRole(
  membershipId: string,
  newRole: string
): Promise<Result> {
  try {
    const { companyId } = await getMyCompanyMembership();
    const target = await prisma.membership.findUnique({
      where: { id: membershipId },
    });

    if (!target || target.companyId !== companyId) {
      throw new UserError("الموظف غير موجود");
    }

    if (target.role === "OWNER") {
      throw new UserError("لا يمكن تغيير صلاحية المالك الأساسي");
    }

    await prisma.membership.update({
      where: { id: membershipId },
      data: { role: newRole },
    });

    revalidatePath("/dashboard/team");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function toggleEmployeeStatus(membershipId: string): Promise<Result> {
  try {
    const { companyId } = await getMyCompanyMembership();
    const target = await prisma.membership.findUnique({
      where: { id: membershipId },
    });

    if (!target || target.companyId !== companyId) {
      throw new UserError("الموظف غير موجود");
    }

    if (target.role === "OWNER") {
      throw new UserError("لا يمكن تعليق حساب المالك");
    }

    const newStatus = target.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";

    await prisma.membership.update({
      where: { id: membershipId },
      data: { status: newStatus },
    });

    revalidatePath("/dashboard/team");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteEmployee(membershipId: string): Promise<Result> {
  try {
    const { companyId } = await getMyCompanyMembership();
    const target = await prisma.membership.findUnique({
      where: { id: membershipId },
    });

    if (!target || target.companyId !== companyId) {
      throw new UserError("الموظف غير موجود");
    }

    if (target.role === "OWNER") {
      throw new UserError("لا يمكن حذف حساب المالك");
    }

    // حذف الحساب من نظام الدخول Stack Auth لتفريغ البريد
    try {
      const u = await stackServerApp.getUser(target.userId);
      await u?.delete();
    } catch (err) {
      console.error(err);
    }

    // حذف السجل من قاعدة البيانات
    await prisma.membership.delete({
      where: { id: membershipId },
    });

    revalidatePath("/dashboard/team");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
