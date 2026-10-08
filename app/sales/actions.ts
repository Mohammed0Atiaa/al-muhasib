"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function voidInvoice(invoiceId: string, reason: string) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error("غير مصرح بالدخول");

    // جلب الفاتورة مع بنودها ومعرفة المخزن المرتبط بها
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

    const voidDetails = `[إلغاء كامل] السبب: ${reason} | بواسطة: ${voidedByName} | الوقت: ${voidedAtFormatted}`;

    // تنفيذ العملية في Transaction لضمان ترابط البيانات
    await prisma.$transaction(async (tx) => {
      // 1. إعادة الكميات المباعة إلى المخزن الخاص بالفاتورة
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

      // 2. تحديث الفاتورة إلى ملغاة وتصفير الأرصدة المالية
      await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          status: "VOIDED",
          voidReason: voidDetails,
          paidAmount: 0,
          balanceDue: 0,
        },
      });
    });

    revalidatePath(`/sales/${invoiceId}`);
    revalidatePath("/sales");
    return { success: true };
  } catch (error: any) {
    console.error("Void Error:", error);
    throw new Error(error.message || "حدث خطأ أثناء إلغاء الفاتورة");
  }
}
