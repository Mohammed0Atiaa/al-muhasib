import { prisma } from "./prisma";

export type CreatePaymentVoucherInput = {
  companyId: string;
  branchId?: string | null;
  entryDate: Date;
  debitAccountId: string;   // قد يكون id أو code لحساب المصروف (مثل "5210")
  creditAccountId: string;  // قد يكون id أو code لطريقة الدفع (مثل "1010")
  amount: number;
  description: string;      
  createdByUserId: string;  
  paidTo: string;           
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
    // 1. البحث الدقيق عن الحساب المدين (المصروف) سواء بالـ id أو الـ code
    let debitAcc = await tx.account.findFirst({
      where: {
        companyId,
        OR: [
          { id: debitAccountId },
          { code: debitAccountId },
        ],
        isGroup: false,
      },
    });

    // حساب افتراضي للإيجار أو أول مصروف متاح كاحتياطي
    if (!debitAcc) {
      debitAcc = await tx.account.findFirst({
        where: { companyId, code: "5210", isGroup: false },
      }) || await tx.account.findFirst({
        where: { companyId, type: "EXPENSE", isGroup: false },
      });
    }

    // 2. البحث الدقيق عن الحساب الدائن (الصندوق/البنك)
    let creditAcc = await tx.account.findFirst({
      where: {
        companyId,
        OR: [
          { id: creditAccountId },
          { code: creditAccountId },
          { code: creditAccountId === "CASH" ? "1010" : creditAccountId },
        ],
        isGroup: false,
      },
    });

    // حساب الصندوق كافتراضي (1010) كاحتياطي
    if (!creditAcc) {
      creditAcc = await tx.account.findFirst({
        where: { companyId, code: "1010", isGroup: false },
      });
    }

    if (!debitAcc || !creditAcc) {
      throw new Error("لم يتم العثور على حسابات صالحة في شجرة الحسابات مطابقة للبيانات المدخلة.");
    }

    // 3. توليد رقم سند فريد آمن
    const voucherNumber = `PAY-${Date.now().toString().slice(-6)}`;

    // 4. إنشاء سند الصرف (PaymentVoucher) أولاً للحصول على الـ id
    const voucher = await tx.paymentVoucher.create({
      data: {
        companyId,
        userId: validUserId,
        number: voucherNumber,
        paidTo: paidTo || "غير محدد",
        expenseCategoryId: debitAcc.id,
        amount: amount,
        method: creditAccountId || "1010",
        notes: description || null,
      },
    });

    // 5. إنشاء القيد المحاسبي المزدوج المرتبط مباشرة بـ sourceId (بدون تعديل لاحقاً لتفادي قيود الـ Immutable)
    const entry = await tx.journalEntry.create({
      data: {
        companyId,
        branchId: input.branchId || null,
        entryDate,
        sourceType: "PAYMENT",
        sourceId: voucher.id,
        description: description || "سند صرف",
        createdByUserId: validUserId,
        lines: {
          create: [
            {
              accountId: debitAcc.id, // الطرف المدين (المصروف)
              debit: amount,
              credit: 0,
            },
            {
              accountId: creditAcc.id, // الطرف الدائن (الصندوق/البنك)
              debit: 0,
              credit: amount,
            },
          ],
        },
      },
    });

    return { voucher, entry };
  });
}
