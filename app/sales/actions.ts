"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function voidInvoice(invoiceId: string, reason: string) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error("غير مصرح بالدخول");

    // جلب الفاتورة مع بنودها
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { items: true },
    });

    if (!invoice) throw new Error("الفاتورة غير موجودة");
    if (invoice.status === "VOIDED") throw new Error("الفاتورة ملغاة بالفعل");

    const voidedByName = user.name || user.email || "مستخدم";
    const voidedAtFormatted = new Date().toLocaleString("ar-KW", {
      timeZone: "Asia/Kuwait",
      dateStyle: "short",
      timeStyle: "short",
    });

    const noteText = `[تم إلغاء الفاتورة بواسطة: ${voidedByName} بتاريخ ${voidedAtFormatted} - السبب: ${reason}]`;

    // تنفيذ الإلغاء وتحديث المخزون
    await prisma.$transaction(async (tx) => {
      // 1. إرجاع الكميات للمخزن إن وُجدت أصناف
      for (const item of invoice.items) {
        if (item.productId) {
          // محاولة تحديث المخزون
          const stockRecord = await tx.stock.findFirst({
            where: { productId: item.productId },
          });

          if (stockRecord) {
            await tx.stock.update({
              where: { id: stockRecord.id },
              data: { quantity: { increment: item.quantity } },
            });
          }
        }
      }

      // 2. تحديث الفاتورة كـ ملغاة وتحديث المبالغ المتبقية
      const updateData: any = {
        status: "VOIDED",
        paidAmount: 0,
        balanceDue: 0,
      };

      // إضافة الملاحظة بالحقل المتوفر
      if ("notes" in invoice) {
        updateData.notes = invoice.notes ? `${invoice.notes}\n${noteText}` : noteText;
      }
      if ("voidReason" in invoice) {
        updateData.voidReason = noteText;
      }

      await tx.invoice.update({
        where: { id: invoiceId },
        data: updateData,
      });
    });

    revalidatePath(`/sales/${invoiceId}`);
    revalidatePath("/sales");
    return { success: true };
  } catch (error: any) {
    console.error("Void Invoice Error:", error);
    throw new Error(error.message || "حدث خطأ أثناء إلغاء الفاتورة");
  }
}
