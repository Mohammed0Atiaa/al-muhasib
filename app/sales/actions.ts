"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getMembership } from "@/lib/company";
import { revalidatePath } from "next/cache";

export async function voidInvoice(invoiceId: string, reason: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("غير مصرح بالدخول");

  const membership = await getMembership(user.id);
  const companyId = membership.companyId;

  // جلب الفاتورة مع بنودها
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, companyId },
    include: { items: true },
  });

  if (!invoice) throw new Error("الفاتورة غير موجودة");
  if (invoice.status === "VOIDED") throw new Error("الفاتورة ملغاة بالفعل");

  const voidedByName = user.name || user.email || "مستخدم غير معرف";
  const voidedAtFormatted = new Date().toLocaleString("ar-KW", {
    timeZone: "Asia/Kuwait",
    dateStyle: "medium",
    timeStyle: "short",
  });

  const fullVoidReason = `سبب الإلغاء: ${reason} | بواسطة: ${voidedByName} | التاريخ: ${voidedAtFormatted}`;

  // تنفيذ عملية الإلغاء وإعادة المخزون في مصفوفة واحدة متكاملة
  await prisma.$transaction(async (tx) => {
    // 1. إرجاع الكميات المباعة إلى المخزن المخصص لهذه الفاتورة
    for (const item of invoice.items) {
      if (item.productId && invoice.warehouseId) {
        await tx.stock.updateMany({
          where: {
            productId: item.productId,
            warehouseId: invoice.warehouseId,
          },
          data: {
            quantity: { increment: item.quantity },
          },
        });
      }
    }

    // 2. تحديث حالة الفاتورة وتصفير المستحقات
    await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        status: "VOIDED",
        voidReason: fullVoidReason,
        paidAmount: 0,
        balanceDue: 0,
      },
    });
  });

  revalidatePath(`/sales/${invoiceId}`);
  revalidatePath("/sales");
  return { success: true };
}
