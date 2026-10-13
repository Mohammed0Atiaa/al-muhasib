import { prisma } from "./prisma";

export type CreatePaymentVoucherInput = {
  companyId: string;
  branchId?: string | null;
  entryDate: Date;
  debitAccountId: string;   // expenseCategoryId
  creditAccountId: string;  // method
  amount: number;
  currency?: string;
  exchangeRate?: number;
  description: string;      // notes / paidTo
  referenceNumber?: string | null;
  createdByUserId: string;  // userId
  paidTo?: string;
};

export async function createPaymentVoucher(input: CreatePaymentVoucherInput) {
  const {
    companyId,
    entryDate,
    debitAccountId,
    creditAccountId,
    amount,
    description,
    createdByUserId,
    paidTo,
  } = input;

  return await prisma.$transaction(async (tx: any) => {
    // 1. توليد رقم سند فريد آمن يعتمد على الوقت لمنع أي خطأ
    const voucherNumber = `PAY-${Date.now().toString().slice(-6)}`;

    // 2. إنشاء القيد المحاسبي المزدوج في شجرة الحسابات والداشبورد
    const entry = await tx.journalEntry.create({
      data: {
        companyId,
        entryDate,
        sourceType: "PAYMENT",
        description: description || "سند صرف",
        lines: {
          create: [
            // الطرف المدين (المصروف)
            {
              accountId: debitAccountId,
              debit: amount,
              credit: 0,
              description: description || "سند صرف - مدين",
            },
            // الطرف الدائن (الخزينة / البنك)
            {
              accountId: creditAccountId,
              debit: 0,
              credit: amount,
              description: description || "سند صرف - دائن",
            },
          ],
        },
      },
    });

    // 3. حفظ سند الصرف بالأسماء الدقيقة لمطابقة جدول قاعدة البيانات
    const voucher = await tx.expense.create({
      data: {
        companyId,
        userId: createdByUserId, 
        number: voucherNumber,   
        paidTo: paidTo || description || "غير محدد", 
        expenseCategoryId: debitAccountId,
        amount: amount,
        method: creditAccountId,
        notes: description,
        createdAt: entryDate,
        updatedAt: new Date(),
      },
    });

    // 4. ربط القيد بمعرف سند الصرف
    await tx.journalEntry.update({
      where: { id: entry.id },
      data: { sourceId: voucher.id },
    });

    return { voucher, entry };
  });
}
