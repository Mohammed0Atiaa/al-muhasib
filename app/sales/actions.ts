"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMembership } from "@/lib/company";

class UserError extends Error {}

export async function voidInvoice(invoiceId: string, reason: string) {
  try {
    const user = await getCurrentUser();
    const membership = await getMembership(user.id);
    const companyId = membership.companyId;

    if (!["OWNER", "MANAGER"].includes(membership.role)) {
      throw new UserError("ليس لديك صلاحية إلغاء الفواتير");
    }
    if (!invoiceId) throw new UserError("معرف الفاتورة غير موجود");
    const cleanReason = (reason ?? "").trim();
    if (cleanReason.length < 3) throw new UserError("سبب الإلغاء مطلوب");

    await prisma.$transaction(
      async (tx) => {
        // حجز الفاتورة: ينجح مرة واحدة فقط حتى لو تم الضغط مرتين
        const claimed = await tx.invoice.updateMany({
          where: { id: invoiceId, companyId, status: "POSTED" },
          data: {
            status: "VOIDED",
            voidedAt: new Date(),
            voidedByUserId: user.id,
            voidReason: cleanReason,
          },
        });
        if (claimed.count !== 1) {
          throw new UserError("الفاتورة غير موجودة أو ملغاة بالفعل");
        }

        const invoice = await tx.invoice.findUniqueOrThrow({
          where: { id: invoiceId },
          include: { items: true },
        });

        const collected = await tx.receiptAllocation.count({
          where: { invoiceId, receipt: { status: "POSTED" } },
        });
        if (collected > 0) {
          throw new UserError(
            "تم تحصيل جزء من هذه الفاتورة بسند قبض، ولا يمكن إلغاؤها قبل إلغاء السند"
          );
        }

        // إرجاع المخزون لنفس المخزن
        for (const item of invoice.items) {
          const r = await tx.warehouseStock.updateMany({
            where: { productId: item.productId, warehouseId: invoice.warehouseId },
            data: { quantity: { increment: item.quantity } },
          });
          if (r.count === 0) {
            await tx.warehouseStock.create({
              data: {
                productId: item.productId,
                warehouseId: invoice.warehouseId,
                quantity: item.quantity,
              },
            });
          }
          await tx.product.update({
            where: { id: item.productId },
            data: { quantity: { increment: item.quantity } },
          });
        }

        // قيد عكسي مطابق للقيد الأصلي (المدين دائن والعكس)
        const original = await tx.journalEntry.findFirst({
          where: { companyId, sourceType: "INVOICE", sourceId: invoiceId },
          include: { lines: true },
        });
        if (!original) throw new UserError("القيد المحاسبي الأصلي غير موجود");

        const reversed = await tx.journalEntry.findFirst({
          where: { reversalOfId: original.id },
        });
        if (reversed) throw new UserError("القيد معكوس بالفعل");

        await tx.journalEntry.create({
          data: {
            companyId,
            branchId: invoice.branchId,
            description: `إلغاء فاتورة ${invoice.number}: ${cleanReason}`,
            sourceType: "INVOICE_VOID",
            sourceId: invoiceId,
            reversalOfId: original.id,
            createdByUserId: user.id,
            lines: {
              create: original.lines.map((l) => ({
                accountId: l.accountId,
                customerId: l.customerId,
                debit: l.credit,
                credit: l.debit,
              })),
            },
          },
        });

        await tx.auditLog.create({
          data: {
            companyId,
            userId: user.id,
            action: "INVOICE_VOIDED",
            entityType: "Invoice",
            entityId: invoiceId,
            reason: cleanReason,
          },
        });
      },
      { timeout: 20000 }
    );

    revalidatePath(`/sales/${invoiceId}`);
    revalidatePath("/sales");
    return { success: true };
  } catch (error) {
    if (error instanceof UserError) {
      return { success: false, error: error.message };
    }
    console.error("Void Invoice Error:", error);
    return { success: false, error: "حدث خطأ غير متوقع أثناء عملية الإلغاء" };
  }
}
