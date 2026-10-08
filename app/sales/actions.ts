"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function voidInvoice(invoiceId: string, reason: string) {
  try {
    if (!invoiceId) {
      return { success: false, error: "معرف الفاتورة غير موجود" };
    }

    // 1. جلب الفاتورة مع بنودها
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { items: true },
    });

    if (!invoice) {
      return { success: false, error: "الفاتورة غير موجودة" };
    }

    if (invoice.status === "VOIDED") {
      return { success: false, error: "الفاتورة ملغاة بالفعل" };
    }

    const voidedAtFormatted = new Date().toLocaleString("ar-KW", {
      timeZone: "Asia/Kuwait",
      dateStyle: "short",
      timeStyle: "short",
    });

    const voidDetails = `[إلغاء كامل] السبب: ${reason || "بدون سبب"} | الوقت: ${voidedAtFormatted}`;

    // 2. تنفيذ عملية الإلغاء واسترجاع المخزون داخل Transaction
    await prisma.$transaction(async (tx) => {
      for (const item of invoice.items) {
        if (item.productId) {
          // البحث عن سجل المخزون المخصص لهذا المنتج وهذا المستودع
          const stockRecord = await tx.stock.findFirst({
            where: {
              productId: item.productId,
              ...(invoice.warehouseId ? { warehouseId: invoice.warehouseId } : {}),
            },
          });

          if (stockRecord) {
            // إعادة الكميات للمخزن
            await tx.stock.update({
              where: { id: stockRecord.id },
              data: {
                quantity: { increment: Number(item.quantity) },
              },
            });
          }
        }
      }

      // 3. تحديث الفاتورة لتصبح ملغاة وتصفير المستحقات
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

    // 4. إنعاش الكاش للصفحة لتحديث البيانات في الواجهة
    revalidatePath(`/sales/${invoiceId}`);
    revalidatePath("/sales");

    return { success: true };
  } catch (error: any) {
    console.error("Void Invoice Error:", error);
    return {
      success: false,
      error: error?.message || "حدث خطأ غير متوقع أثناء عملية الإلغاء",
    };
  }
}
