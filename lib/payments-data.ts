import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { ApiError } from "./api-errors";

const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);

// ربط بنود المصروف في الواجهة بحسابات شجرة الحسابات (لا رجوع صامت لحساب افتراضي)
export const EXPENSE_CATEGORIES = {
  rent: { code: "5210", label: "إيجار" },
  salaries: { code: "5110", label: "رواتب ومستحقات" },
  employee_advance: { code: "1120", label: "سلفة / عهدة موظف" },
  electricity: { code: "5220", label: "رسوم كهرباء وماء" },
  fuel: { code: "5230", label: "بنزين ونقليات" },
  supplies: { code: "5250", label: "نثريات" },
  maintenance: { code: "5240", label: "صيانة وتشغيل" },
} as const;

export type ExpenseCategoryKey = keyof typeof EXPENSE_CATEGORIES;
export const EXPENSE_CATEGORY_KEYS = Object.keys(EXPENSE_CATEGORIES) as [
  ExpenseCategoryKey,
  ...ExpenseCategoryKey[],
];

// ربط طريقة الدفع بحساب الصندوق/المقاصة/البنك
export const PAYMENT_METHOD_ACCOUNTS = {
  CASH: "1010",
  KNET: "1020",
  CARD: "1030",
  TRANSFER: "1040",
} as const;

export type PaymentMethodKey = keyof typeof PAYMENT_METHOD_ACCOUNTS;

export type CreatePaymentVoucherInput = {
  companyId: string;
  userId: string;
  requestedBranchId?: string | null;
  forcedBranchId?: string | null; // فرع المستخدم المقيّد (إن وُجد)
  category: ExpenseCategoryKey;
  method: PaymentMethodKey;
  paidTo: string;
  amount: number;
  notes?: string;
  currency?: string; // إن أُرسلت يجب أن تطابق عملة الشركة الأساسية
};

function assertBalanced(lines: { debit: Prisma.Decimal; credit: Prisma.Decimal }[]) {
  const dr = lines.reduce((s, l) => s.add(l.debit), D(0));
  const cr = lines.reduce((s, l) => s.add(l.credit), D(0));
  if (!dr.equals(cr) || dr.lte(0)) {
    throw new ApiError(422, "القيد غير متوازن: مجموع المدين لا يساوي مجموع الدائن");
  }
}

export async function createPaymentVoucher(input: CreatePaymentVoucherInput) {
  const { companyId, userId } = input;

  return prisma.$transaction(
    async (tx) => {
      // 1) الشركة وعملتها الأساسية ودقتها العشرية
      const company = await tx.company.findUnique({
        where: { id: companyId },
        select: { baseCurrency: true },
      });
      if (!company) throw new ApiError(404, "الشركة غير موجودة");

      if (input.currency && input.currency !== company.baseCurrency) {
        throw new ApiError(
          422,
          `سند الصرف يُصدر حاليًا بعملة الشركة الأساسية (${company.baseCurrency}) فقط`
        );
      }

      const currency = await tx.currency.findUnique({ where: { code: company.baseCurrency } });
      if (!currency) throw new ApiError(422, "عملة الشركة غير معرّفة في النظام");

      // 2) المبلغ: يجب ألا يتجاوز خانات العملة العشرية (لا تقريب صامت)
      const raw = D(String(input.amount));
      const amount = raw.toDecimalPlaces(currency.decimals, Prisma.Decimal.ROUND_HALF_UP);
      if (!amount.equals(raw)) {
        throw new ApiError(422, `المبلغ يجب ألا يتجاوز ${currency.decimals} خانات عشرية`);
      }
      if (amount.lte(0)) throw new ApiError(422, "يرجى إدخال مبلغ صحيح أكبر من الصفر");
      if (amount.gte(D("1000000000"))) throw new ApiError(422, "المبلغ كبير جدًا");

      // 3) الفرع: يجب أن يتبع الشركة (ولا يخرج المستخدم المقيّد عن فرعه)
      let branchId = input.forcedBranchId ?? null;
      if (branchId && input.requestedBranchId && input.requestedBranchId !== branchId) {
        throw new ApiError(422, "غير مسموح لك بالصرف من هذا الفرع");
      }
      branchId = branchId ?? input.requestedBranchId ?? null;

      const branch = branchId
        ? await tx.branch.findFirst({ where: { id: branchId, companyId, isActive: true } })
        : await tx.branch.findFirst({
            where: { companyId, isActive: true },
            orderBy: { code: "asc" },
          });
      if (!branch) throw new ApiError(422, "الفرع غير صحيح أو غير نشط");

      // 4) الحسابات: مطابقة صارمة بالكود، بدون أي بديل صامت
      const debitMeta = EXPENSE_CATEGORIES[input.category];
      const creditCode = PAYMENT_METHOD_ACCOUNTS[input.method];

      const accounts = await tx.account.findMany({
        where: { companyId, code: { in: [debitMeta.code, creditCode] }, isGroup: false, isActive: true },
        select: { id: true, code: true, type: true },
      });
      const debitAcc = accounts.find((a) => a.code === debitMeta.code);
      const creditAcc = accounts.find((a) => a.code === creditCode);
      if (!debitAcc) {
        throw new ApiError(
          422,
          `حساب البند (${debitMeta.code} - ${debitMeta.label}) غير موجود في شجرة حسابات الشركة`
        );
      }
      if (!creditAcc) {
        throw new ApiError(422, `حساب طريقة الدفع (${creditCode}) غير موجود في شجرة حسابات الشركة`);
      }

      // 5) رقم السند: متسلسل لكل فرع داخل نفس الـ transaction
      const counter = await tx.documentCounter.upsert({
        where: {
          companyId_branchId_docType: { companyId, branchId: branch.id, docType: "PAYMENT" },
        },
        create: { companyId, branchId: branch.id, docType: "PAYMENT", lastNumber: 1 },
        update: { lastNumber: { increment: 1 } },
      });
      const number = `${branch.code}-P${String(counter.lastNumber).padStart(6, "0")}`;

      const description =
        [`إلى: ${input.paidTo}`, debitMeta.label, input.notes].filter(Boolean).join(" - ") ||
        "سند صرف";

      // 6) السند ثم القيد المزدوج
      const voucher = await tx.paymentVoucher.create({
        data: {
          companyId,
          userId,
          number,
          paidTo: input.paidTo,
          expenseCategoryId: null, // الواجهة ترسل مفتاح بند وليس معرّف ExpenseCategory
          amount,
          method: input.method,
          notes: description,
        },
      });

      const lines = [
        { accountId: debitAcc.id, debit: amount, credit: D(0) },
        { accountId: creditAcc.id, debit: D(0), credit: amount },
      ];
      assertBalanced(lines);

      const entry = await tx.journalEntry.create({
        data: {
          companyId,
          branchId: branch.id,
          description: `سند صرف ${number} - ${description}`,
          sourceType: "PAYMENT",
          sourceId: voucher.id,
          createdByUserId: userId,
          lines: { create: lines },
        },
      });

      await tx.auditLog.create({
        data: {
          companyId,
          userId,
          action: "PAYMENT_CREATED",
          entityType: "PaymentVoucher",
          entityId: voucher.id,
          reason: `${number} | ${debitMeta.code} <- ${creditCode} | ${amount.toString()} ${company.baseCurrency}`,
        },
      });

      return {
        id: voucher.id,
        voucher: { id: voucher.id, number, amount: amount.toString() },
        entryId: entry.id,
      };
    },
    { timeout: 20000 }
  );
}
