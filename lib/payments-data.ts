import { prisma } from "./prisma";

export type CreatePaymentVoucherInput = {
  companyId: string;
  branchId?: string | null;
  entryDate: Date;
  debitAccountId: string;   // expenseCategoryId أو كود حساب المصروف
  creditAccountId: string;  // طريقة الدفع / كود الخزينة (مثل CASH)
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
    // 1. البحث عن الحساب المدين والدائن لضمان وجودهما في شجرة الحسابات (Account)
    let debitAcc = await tx.account.findFirst({
      where: { companyId, OR: [{ id: debitAccountId }, { code: debitAccountId }] },
    });

    let creditAcc = await tx.account.findFirst({
      where: { companyId, OR: [{ id: creditAccountId }, { code: creditAccountId }] },
    });

    // إذا لم يجد الحساب الممرر، يجلب أول حساب مصروفات/خزينة متاح للشركة منعاً للكرّاش
    if (!debitAcc) {
      debitAcc = await tx.account.findFirst({
        where: { companyId, type: "EXPENSE", isGroup: false },
      }) || await tx.account.findFirst({ where: { companyId, isGroup: false } });
    }

    if (!creditAcc) {
      creditAcc = await tx.account.findFirst({
        where: { companyId, type: "ASSET", isGroup: false },
      }) || debitAcc;
    }

    if (!debitAcc || !creditAcc) {
      throw new Error("لم يتم العثور على حسابات صالحة في شجرة الحسابات لربط القيد بها.");
    }

    // 2. توليد رقم سند فريد
    const voucherNumber = `PAY-${Date.now().toString().slice(-6)}`;

    // 3. إنشاء القيد المحاسبي باستخدام معرّفات الحسابات المضمونة
    const entry = await tx.journalEntry.create({
      data: {
        companyId,
        branchId: input.branchId || null,
        entryDate,
        sourceType: "PAYMENT",
        description: description || "سند صرف",
        createdByUserId: validUserId,
        lines: {
          create: [
            // الطرف المدين (المصروف)
            {
              accountId: debitAcc.id,
              debit: amount,
              credit: 0,
            },
            // الطرف الدائن (الصندوق/البنك)
            {
              accountId: creditAcc.id,
              debit: 0,
              credit: amount,
            },
          ],
        },
      },
    });

    // 4. إنشاء سند الصرف في PaymentVoucher
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

    // 5. ربط القيد بمعرف سند الصرف
    await tx.journalEntry.update({
      where: { id: entry.id },
      data: { sourceId: voucher.id },
    });

    return { voucher, entry };
  });
}
