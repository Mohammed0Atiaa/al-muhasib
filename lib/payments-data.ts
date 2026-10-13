import { prisma } from "./prisma";

export type CreatePaymentVoucherInput = {
  companyId: string;
  branchId?: string | null;
  entryDate: Date;
  debitAccountId: string;   // expenseCategoryId (معرّف فئة المصروف في ExpenseCategory)
  creditAccountId: string;  // method (مثل "CASH")
  amount: number;
  description: string;      // notes
  createdByUserId: string;  // المستخدم المنشئ
  paidTo: string;           // المستفيد
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

  const validUserId = createdByUserId || "system-user";

  return await prisma.$transaction(async (tx) => {
    // 1. توليد رقم سند فريد آمن لجدول PaymentVoucher
    const voucherNumber = `PAY-${Date.now().toString().slice(-6)}`;

    // 2. إنشاء القيد المحاسبي في JournalEntry (باستخدام createdByUserId المطابق للـ Schema)
    const entry = await tx.journalEntry.create({
      data: {
        companyId,
        branchId: input.branchId || null,
        entryDate,
        sourceType: "PAYMENT",
        description: description || "سند صرف",
        createdByUserId: validUserId, // الاسم الصحيح بحسب الـ Schema
        lines: {
          create: [
            // الطرف المدين (المصروف)
            {
              accountId: debitAccountId,
              debit: amount,
              credit: 0,
            },
            // الطرف الدائن (طريقة الدفع / الصندوق)
            {
              accountId: creditAccountId,
              debit: 0,
              credit: amount,
            },
          ],
        },
      },
    });

    // 3. إنشاء سند الصرف في جدول PaymentVoucher (بالحقول الدقيقة للـ Schema)
    const voucher = await tx.paymentVoucher.create({
      data: {
        companyId,
        userId: validUserId,
        number: voucherNumber,
        paidTo: paidTo || "غير محدد",
        expenseCategoryId: debitAccountId || null,
        amount: amount,
        method: creditAccountId || "CASH",
        notes: description || null,
      },
    });

    // 4. ربط القيد بمعرف سند الصرف (sourceId) ليعمل رابط أحدث العمليات بكفاءة
    await tx.journalEntry.update({
      where: { id: entry.id },
      data: { sourceId: voucher.id },
    });

    return { voucher, entry };
  });
}
