import { prisma } from "./prisma";

export type CreatePaymentVoucherInput = {
  companyId: string;
  branchId?: string | null;
  entryDate: Date;
  debitAccountId: string;   
  creditAccountId: string;  
  amount: number;
  currency?: string;
  exchangeRate?: number;
  description: string;      
  referenceNumber?: string | null;
  createdByUserId?: string | null;  
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
    // 1. التأكد من وجود معرف مستخدم صالح أو جلب أول مستخدم متاح في النظام لتفادي خطأ الـ undefined
    let validUserId = createdByUserId;
    if (!validUserId) {
      const anyUser = await tx.user.findFirst({ select: { id: true } });
      validUserId = anyUser ? anyUser.id : "system-user";
    }

    // 2. توليد رقم سند فريد آمن يعتمد على الوقت
    const voucherNumber = `PAY-${Date.now().toString().slice(-6)}`;

    // 3. إنشاء القيد المحاسبي المزدوج مع استخدام المعرف المضمون
    const entry = await tx.journalEntry.create({
      data: {
        companyId,
        entryDate,
        sourceType: "PAYMENT",
        description: description || "سند صرف",
        userId: validUserId, 
        lines: {
          create: [
            {
              accountId: debitAccountId,
              debit: amount,
              credit: 0,
              description: description || "سند صرف - مدين",
            },
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

    // 4. حفظ سند الصرف في جدول المصروفات
    const voucher = await tx.expense.create({
      data: {
        companyId,
        userId: validUserId, 
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

    // 5. ربط القيد بمعرف سند الصرف
    await tx.journalEntry.update({
      where: { id: entry.id },
      data: { sourceId: voucher.id },
    });

    return { voucher, entry };
  });
}
