import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

export type CreatePaymentVoucherInput = {
  companyId: string;
  branchId?: string | null;
  entryDate: Date;
  debitAccountId: string;   // حساب المصروف أو المورد (مدين)
  creditAccountId: string;  // حساب الخزينة أو البنك (دائن)
  amount: number;
  currency: string;
  exchangeRate: number;
  description: string;
  referenceNumber?: string | null;
  createdByUserId: string;
};

/**
 * إنشاء سند صرف مع توليد قيد محاسبي مزدوج تلقائياً في شجرة الحسابات
 */
export async function createPaymentVoucher(input: CreatePaymentVoucherInput) {
  const {
    companyId,
    branchId,
    entryDate,
    debitAccountId,
    creditAccountId,
    amount,
    currency,
    exchangeRate,
    description,
    referenceNumber,
    createdByUserId,
  } = input;

  const baseAmount = Number((amount * exchangeRate).toFixed(4));

  return await prisma.$transaction(async (tx) => {
    // 1. توليد القيد المحاسبي الرئيسي
    const entry = await tx.journalEntry.create({
      data: {
        companyId,
        branchId: branchId || null,
        entryDate,
        sourceType: "PAYMENT", // العلامة التي تقرؤها الداشبورد لسندات الصرف
        description: description || "سند صرف",
        referenceNumber: referenceNumber || null,
        createdById: createdByUserId,
        lines: {
          create: [
            // الطرف المدين (المصروف أو المورد)
            {
              accountId: debitAccountId,
              debit: baseAmount,
              credit: 0,
              description: description || "سند صرف - مدين",
            },
            // الطرف الدائن (الخزينة أو البنك)
            {
              accountId: creditAccountId,
              debit: 0,
              credit: baseAmount,
              description: description || "سند صرف - دائن",
            },
          ],
        },
      },
      include: {
        lines: true,
      },
    });

    // 2. إنشاء / تحديث سجّل سند الصرف مع ربطه بمعرف القيد
    const voucher = await tx.paymentVoucher.create({
      data: {
        companyId,
        branchId: branchId || null,
        journalEntryId: entry.id,
        entryDate,
        debitAccountId,
        creditAccountId,
        amount,
        currency,
        exchangeRate,
        baseAmount,
        description,
        referenceNumber,
        createdById: createdByUserId,
      },
    });

    // 3. ربط القيد بمعرف سند الصرف في حالة وجود حقل sourceId
    await tx.journalEntry.update({
      where: { id: entry.id },
      data: { sourceId: voucher.id },
    });

    return { voucher, entry };
  });
}

/**
 * إلغاء سند الصرف وعكس القيد المحاسبي تلقائياً
 */
export async function voidPaymentVoucher(opts: {
  voucherId: string;
  companyId: string;
  userId: string;
  reason?: string;
}) {
  const { voucherId, companyId, userId, reason } = opts;

  return await prisma.$transaction(async (tx) => {
    // جلب سند الصرف والقيد المرتبط به
    const voucher = await tx.paymentVoucher.findFirst({
      where: { id: voucherId, companyId },
      include: { journalEntry: { include: { lines: true } } },
    });

    if (!voucher) throw new Error("سند الصرف غير موجود");
    if (voucher.status === "VOIDED") throw new Error("السند ملغى بالفعل");

    const originalEntry = voucher.journalEntry;
    if (!originalEntry) throw new Error("لا يوجد قيد محاسبي مرتبط بهذا السند");

    // إنشاء قيد عكسي لقيد سند الصرف الأصلي
    const reverseEntry = await tx.journalEntry.create({
      data: {
        companyId: voucher.companyId,
        branchId: voucher.branchId,
        entryDate: new Date(),
        sourceType: "PAYMENT",
        sourceId: voucher.id,
        reversalOfId: originalEntry.id,
        description: `إلغاء سند صرف رقم: ${voucher.id} - ${reason || "بدون سبب مكرر"}`,
        createdById: userId,
        lines: {
          create: originalEntry.lines.map((line) => ({
            accountId: line.accountId,
            debit: line.credit,  // عكس المدين والدائن
            credit: line.debit,
            description: `عكس: ${line.description || "سند صرف ملغى"}`,
          })),
        },
      },
    });

    // تحديث حالة سند الصرف إلى ملغى (VOIDED)
    const updatedVoucher = await tx.paymentVoucher.update({
      where: { id: voucherId },
      data: {
        status: "VOIDED",
        voidedAt: new Date(),
        voidedById: userId,
        voidReason: reason || null,
      },
    });

    return { updatedVoucher, reverseEntry };
  });
}
