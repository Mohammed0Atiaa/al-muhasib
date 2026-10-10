"use server";

import { randomInt } from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { stackServerApp } from "@/stack/server";
import { getCurrentUser } from "../auth";
import { prisma } from "../prisma";
import { COUNTRIES } from "../countries";
import { isPlatformAdmin, MAX_COMPANIES } from "../platform";

class UserError extends Error {}

type Result =
  | { ok: true; id?: string; password?: string }
  | { ok: false; error: string };

const DEFAULT_ACCOUNTS = [
  { code: "1010", name: "الصندوق", type: "ASSET" },
  { code: "1020", name: "كي نت (مقاصة)", type: "ASSET" },
  { code: "1030", name: "فيزا/ماستر (مقاصة)", type: "ASSET" },
  { code: "1100", name: "العملاء (ذمم مدينة)", type: "ASSET" },
  { code: "1200", name: "المخزون", type: "ASSET" },
  { code: "4000", name: "إيرادات المبيعات", type: "REVENUE" },
  { code: "5000", name: "تكلفة البضاعة المباعة", type: "EXPENSE" },
  { code: "5900", name: "فروق عملة", type: "EXPENSE" },
];

const CreateSchema = z.object({
  name: z.string().trim().min(2, "اسم الشركة مطلوب"),
  country: z.string().refine((c) => c in COUNTRIES, "اختر البلد"),
  email: z.string().trim().toLowerCase().email("إيميل غير صحيح"),
  phone: z.string().trim().min(6, "رقم الهاتف مطلوب"),
  address: z.string().trim().optional(),
  password: z.string().min(10, "كلمة السر 10 أحرف على الأقل").max(72),
});

function fail(e: unknown): Result {
  if (e instanceof UserError) return { ok: false, error: e.message };
  console.error(e);
  return { ok: false, error: "حدث خطأ غير متوقع" };
}

async function adminOrThrow() {
  const user = await getCurrentUser();
  if (!(await isPlatformAdmin(user.id))) throw new UserError("غير مسموح");
  return user;
}

function generatePassword(len = 14) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[randomInt(chars.length)];
  return out;
}

export async function createCompany(input: unknown): Promise<Result> {
  let ownerId: string | null = null;
  try {
    const admin = await adminOrThrow();
    const parsed = CreateSchema.safeParse(input);
    if (!parsed.success) {
      throw new UserError(parsed.error.issues[0]?.message ?? "بيانات غير صحيحة");
    }
    const d = parsed.data;

    const used = await prisma.company.count({ where: { status: { not: "DELETED" } } });
    if (used >= MAX_COMPANIES) {
      throw new UserError(`وصلت للحد الأقصى (${MAX_COMPANIES} شركات)`);
    }

    let owner;
    try {
      owner = await stackServerApp.createUser({
        primaryEmail: d.email,
        password: d.password,
        primaryEmailAuthEnabled: true,
        primaryEmailVerified: true,
        displayName: `مدير ${d.name}`,
      });
    } catch (e) {
      console.error(e);
      throw new UserError(
        "تعذر إنشاء حساب الدخول: الإيميل مستخدم بالفعل أو كلمة السر مرفوضة"
      );
    }
    ownerId = owner.id;

    const company = await prisma.$transaction(async (tx) => {
      const c = await tx.company.create({
        data: {
          name: d.name,
          baseCurrency: COUNTRIES[d.country].currency,
          country: d.country,
          email: d.email,
          phone: d.phone,
          address: d.address || null,
        },
      });
      const branch = await tx.branch.create({
        data: { companyId: c.id, code: "MAIN", name: "الفرع الرئيسي" },
      });
      await tx.warehouse.create({
        data: { companyId: c.id, branchId: branch.id, name: "المخزن الرئيسي" },
      });
      await tx.account.createMany({
        data: DEFAULT_ACCOUNTS.map((a) => ({ companyId: c.id, ...a })),
      });
      await tx.membership.create({
        data: {
          companyId: c.id,
          userId: owner.id,
          role: "OWNER",
          mustChangePassword: true,
        },
      });
      await tx.auditLog.create({
        data: {
          companyId: c.id,
          userId: admin.id,
          action: "COMPANY_CREATED",
          entityType: "Company",
          entityId: c.id,
        },
      });
      return c;
    });

    revalidatePath("/admin/companies");
    return { ok: true, id: company.id };
  } catch (e) {
    if (ownerId) {
      try {
        const u = await stackServerApp.getUser(ownerId);
        await u?.delete();
      } catch (err) {
        console.error(err);
      }
    }
    return fail(e);
  }
}

export async function setCompanyStatus(
  companyId: string,
  status: "ACTIVE" | "SUSPENDED"
): Promise<Result> {
  try {
    const admin = await adminOrThrow();
    if (status !== "ACTIVE" && status !== "SUSPENDED") throw new UserError("حالة غير صحيحة");
    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company || company.status === "DELETED") throw new UserError("الشركة غير موجودة");

    await prisma.company.update({
      where: { id: companyId },
      data: { status, suspendedAt: status === "SUSPENDED" ? new Date() : null },
    });
    await prisma.auditLog.create({
      data: {
        companyId,
        userId: admin.id,
        action: status === "SUSPENDED" ? "COMPANY_SUSPENDED" : "COMPANY_ACTIVATED",
        entityType: "Company",
        entityId: companyId,
      },
    });
    revalidatePath("/admin/companies");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function resetOwnerPassword(companyId: string): Promise<Result> {
  try {
    const admin = await adminOrThrow();
    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company || company.status === "DELETED") throw new UserError("الشركة غير موجودة");

    const member = await prisma.membership.findFirst({
      where: { companyId, role: "OWNER" },
      orderBy: { id: "asc" },
    });
    if (!member) throw new UserError("لا يوجد مدير لهذه الشركة");

    const user = await stackServerApp.getUser(member.userId);
    if (!user) throw new UserError("حساب المدير غير موجود في نظام الدخول");

    const password = generatePassword();
    await user.update({ password });
    await prisma.membership.update({
      where: { id: member.id },
      data: { mustChangePassword: true },
    });
    await prisma.auditLog.create({
      data: {
        companyId,
        userId: admin.id,
        action: "OWNER_PASSWORD_RESET",
        entityType: "Company",
        entityId: companyId,
      },
    });
    return { ok: true, password };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteCompany(
  companyId: string,
  confirmName: string
): Promise<Result> {
  try {
    const admin = await adminOrThrow();
    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company || company.status === "DELETED") throw new UserError("الشركة غير موجودة");
    if ((confirmName ?? "").trim() !== company.name) {
      throw new UserError("اسم الشركة غير مطابق");
    }

    const members = await prisma.membership.findMany({ where: { companyId } });
    for (const m of members) {
      if (await isPlatformAdmin(m.userId)) continue;
      try {
        const u = await stackServerApp.getUser(m.userId);
        await u?.delete();
      } catch (err) {
        console.error(err);
      }
    }

    await prisma.company.update({
      where: { id: companyId },
      data: { status: "DELETED", deletedAt: new Date() },
    });
    await prisma.auditLog.create({
      data: {
        companyId,
        userId: admin.id,
        action: "COMPANY_DELETED",
        entityType: "Company",
        entityId: companyId,
      },
    });
    revalidatePath("/admin/companies");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
