import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

export type CreatePaymentVoucherInput = {
  companyId: string;
  branchId?: string | null;
  entryDate: Date;
  debitAccountId: string;   
  creditAccountId: string;  
  amount: number;
  currency: string;
  exchangeRate: number;
  description: string;
  referenceNumber?: string | null;
  createdByUserId?: string | null; // جعلناه اختيارياً لمنع خطأ الـ undefined
};

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
    // 1. توليد القيد المحاسبي الرئيسي مع التعامل الآمن مع معرف المستخدم
    const entryData: any = {
      companyId,
      branchId: branchId || null,
      entryDate,
      sourceType: "PAYMENT",
      description: description || "سند صرف",
      referenceNumber: referenceNumber || null,
      lines: {
        create: [
          {
            accountId: debitAccountId,
            debit: baseAmount,
            credit: 0,
            description: description || "سند صرف - مدين",
          },
          {
            accountId: creditAccountId,
            debit: 0,
            credit: baseAmount,
            description: description || "سند صرف - دائن",
          },
        ],
      },
    };

    if (createdByUserId) {
      entryData.createdById = createdByUserId;
    }

    const entry = await tx.journalEntry.create({
      data: entryData,
      include: {
        lines: true,
      },
    });

    // 2. إنشاء سجّل سند الصرف مع ربطه بمعرف القيد
    const voucherData: any = {
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
    };

    if (createdByUserId) {
      voucherData.createdById = createdByUserId;
    }

    const voucher = await tx.paymentVoucher.create({
      data: voucherData,
    });

    // 3. ربط القيد بمعرف سند الصرف
    await tx.journalEntry.update({
      where: { id: entry.id },
      data: { sourceId: voucher.id },
    });

    return { voucher, entry };
  });
}
