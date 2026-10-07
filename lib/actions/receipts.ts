"use server";

import { Prisma } from "@prisma/client";
import { z } from "zod";
import { getCurrentUser } from "../auth";
import { prisma } from "../prisma";
import { getMembership } from "../company";

class UserError extends Error {}

const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);

const ReceiptSchema = z.object({
  branchId: z.string().min(1),
  customerId: z.string().min(1),
  currency: z.string().min(1),
  method: z.enum(["CASH", "KNET", "CARD"]),
  amount: z.coerce.number().positive(),
  invoiceId: z.string().nullable().optional(),
  notes: z.string().optional(),
});

const METHOD_ACCOUNT = { CASH: "1010", KNET: "1020", CARD: "1030" } as const;

type Result =
  | { ok: true; id: string; number: string }
  | { ok: false; error: string };

export async function createReceipt(input: unknown): Promise<Result> {
  try {
    const user = await getCurrentUser();
    const membership = await getMembership(user.id);
    const companyId = membership.companyId;

    const parsed = ReceiptSchema.safeParse(input);
    if (!parsed.success) throw new UserError("بيانات السند غير صحيحة");
    const data = parsed.data;

    if (membership.branchId && membership.branchId !== data.branchId) {
      throw new UserError("غير مسموح لك بالتحصيل من هذا الفرع");
    }

    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new UserError("الشركة غير موجودة");

    const branch = await prisma.branch.findFirst({
      where: { id: data.branchId, companyId },
    });
    if (!branch) throw new UserError("الفرع غير صحيح");

    const customer = await prisma.customer.findFirst({
      where: { id: data.customerId, companyId },
    });
    if (!customer) throw new UserError("العميل غير موجود");

    const [cur, baseCur] = await Promise.all([
      prisma.currency.findUnique({ where: { code: data.currency } }),
      prisma.currency.findUnique({ where: { code: company.baseCurrency } }),
    ]);
    if (!cur || !baseCur) throw new UserError("العملة غير معرّفة");

    let rate = D(1);
    if (data.currency !== company.baseCurrency) {
      const r = await prisma.exchangeRate.findFirst({
        where: {
          companyId,
          currency: data.currency,
          effectiveDate: { lte: new Date() },
        },
        orderBy: { effectiveDate: "desc" },
      });
      if (!r) throw new UserError("لا يوجد سعر صرف لهذه العملة");
      rate = r.rate;
    }

    const amount = D(data.amount).toDecimalPlaces(cur.decimals);
    if (amount.lte(0)) throw new UserError("المبلغ غير صحيح");
    const baseRound = (x: Prisma.Decimal) => x.toDecimalPlaces(baseCur.decimals);

    const accounts = await prisma.account.findMany({
      where: { companyId, code: { in: ["1010", "1020", "1030", "1100", "5900"] } },
    });
    const acc = (code: string) => {
      const a = accounts.find((x) => x.code === code);
      if (!a) throw new UserError(`الحساب ${code} غير موجود`);
      return a.id;
    };

    const result = await prisma.$transaction(
      async (tx) => {
        const open = await tx.invoice.findMany({
          where: {
            companyId,
            customerId: data.customerId,
            currency: data.currency,
            status: "POSTED",
            balanceDue: { gt: 0 },
            ...(data.invoiceId ? { id: data.invoiceId } : {}),
          },
          orderBy: { createdAt: "asc" },
        });
        if (open.length === 0) {
          throw new UserError("لا توجد فواتير آجلة مفتوحة لهذا العميل بهذه العملة");
        }

        // قفل الفواتير حتى لا يتم تخصيصها مرتين في نفس اللحظة
        await tx.$queryRaw`SELECT "id" FROM "Invoice" WHERE "id" IN (${Prisma.join(
          open.map((i) => i.id)
        )}) FOR UPDATE`;

        const done = await tx.receiptAllocation.groupBy({
          by: ["invoiceId"],
          where: {
            invoiceId: { in: open.map((i) => i.id) },
            receipt: { status: "POSTED" },
          },
          _sum: { amount: true },
        });
        const doneMap = new Map(
          done.map((d) => [d.invoiceId, d._sum.amount ?? D(0)])
        );

        let left = amount;
        const allocs: { invoice: (typeof open)[number]; amount: Prisma.Decimal }[] = [];
        for (const inv of open) {
          if (left.lte(0)) break;
          const remaining = inv.balanceDue.sub(doneMap.get(inv.id) ?? D(0));
          if (remaining.lte(0)) continue;
          const take = left.lt(remaining) ? left : remaining;
          allocs.push({ invoice: inv, amount: take });
          left = left.sub(take);
        }
        if (allocs.length === 0) throw new UserError("لا يوجد مبلغ متبقي على هذه الفواتير");
        if (left.gt(0)) throw new UserError("المبلغ أكبر من المتبقي على الفواتير المفتوحة");

        const debitBase = baseRound(amount.mul(rate));
        let creditBase = D(0);
        for (const a of allocs) {
          creditBase = creditBase.add(baseRound(a.amount.mul(a.invoice.exchangeRate)));
        }
        const diff = debitBase.sub(creditBase); // + ربح صرف، - خسارة صرف

        const lines: {
          accountId: string;
          customerId?: string;
          debit?: Prisma.Decimal;
          credit?: Prisma.Decimal;
        }[] = [
          { accountId: acc(METHOD_ACCOUNT[data.method]), debit: debitBase },
          { accountId: acc("1100"), customerId: data.customerId, credit: creditBase },
        ];
        if (diff.gt(0)) lines.push({ accountId: acc("5900"), credit: diff });
        if (diff.lt(0)) lines.push({ accountId: acc("5900"), debit: diff.neg() });

        const counter = await tx.documentCounter.upsert({
          where: {
            companyId_branchId_docType: {
              companyId,
              branchId: data.branchId,
              docType: "RECEIPT",
            },
          },
          create: { companyId, branchId: data.branchId, docType: "RECEIPT", lastNumber: 1 },
          update: { lastNumber: { increment: 1 } },
        });
        const number = `${branch.code}-R${String(counter.lastNumber).padStart(6, "0")}`;

        const receipt = await tx.receiptVoucher.create({
          data: {
            companyId,
            branchId: data.branchId,
            customerId: data.customerId,
            number,
            method: data.method,
            currency: data.currency,
            exchangeRate: rate,
            amount,
            notes: data.notes,
            createdByUserId: user.id,
            allocations: {
              create: allocs.map((a) => ({ invoiceId: a.invoice.id, amount: a.amount })),
            },
          },
        });

        await tx.journalEntry.create({
          data: {
            companyId,
            branchId: data.branchId,
            description: `سند قبض ${number} - ${customer.name}`,
            sourceType: "RECEIPT",
            sourceId: receipt.id,
            createdByUserId: user.id,
            lines: { create: lines },
          },
        });

        await tx.auditLog.create({
          data: {
            companyId,
            userId: user.id,
            action: "RECEIPT_CREATED",
            entityType: "ReceiptVoucher",
            entityId: receipt.id,
          },
        });

        return { id: receipt.id, number };
      },
      { timeout: 20000 }
    );

    return { ok: true, ...result };
  } catch (e) {
    if (e instanceof UserError) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: "حدث خطأ غير متوقع" };
  }
}
