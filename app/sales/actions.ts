"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function voidInvoice(invoiceId: string, reason: string) {
  try {
    if (!invoiceId) {
      return { success: false, error: "معرف الفاتورة غير موجود" };
    }

    // جلب الفاتورة مع البنود
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

    // تنفيذ التعديلات داخل Transaction
    await prisma.$transaction(async (tx) => {
      // 1. إعادة الكميات إلى المخزن
      for (const item of invoice.items) {
        if (item.productId) {
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

      // 2. تحديث حالة الفاتورة وتصفير المبالغ
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
    console.error("Void Invoice Error:", error);
    return { 
      success: false, 
      error: error?.message || "حدث خطأ غير متوقع أثناء إلغاء الفاتورة" 
    };
  }
}
