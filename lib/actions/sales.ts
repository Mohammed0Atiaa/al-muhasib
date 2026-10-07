"use server";

import { Prisma } from "@prisma/client";
import { z } from "zod";
import { getCurrentUser } from "../auth";
import { prisma } from "../prisma";
import { getMembership } from "../company";

class UserError extends Error {}

const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
const sum = (xs: Prisma.Decimal[]) => xs.reduce((s, x) => s.add(x), D(0));

const InvoiceSchema = z.object({
  branchId: z.string().min(1),
  warehouseId: z.string().min(1),
  customerId: z.string().nullable().optional(),
  currency: z.string().min(1),
  discountType: z.enum(["NONE", "PERCENT", "FIXED"]),
  discountValue: z.coerce.number().min(0),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.coerce.number().int().positive(),
        unitPrice: z.coerce.number().min(0),
      })
    )
    .min(1),
  payments: z.array(
    z.object({
      method: z.enum(["CASH", "KNET", "CARD"]),
      amount: z.coerce.number().positive(),
    })
  ),
});

const METHOD_ACCOUNT = { CASH: "1010", KNET: "1020", CARD: "1030" } as const;

type Result =
  | { ok: true; id: string; number: string }
  | { ok: false; error: string };

export async function createInvoice(input: unknown): Promise<Result> {
  try {
    const user = await getCurrentUser();
    const membership = await getMembership(user.id);
    const companyId = membership.companyId;

    const parsed = InvoiceSchema.safeParse(input);
    if (!parsed.success) throw new UserError("بيانات الفاتورة غير صحيحة");
    const data = parsed.data;

    if (membership.branchId && membership.branchId !== data.branchId) {
      throw new UserError("غير مسموح لك بالبيع من هذا الفرع");
    }

    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new UserError("الشركة غير موجودة");

    const warehouse = await prisma.warehouse.findFirst({
      where: { id: data.warehouseId, companyId, branchId: data.branchId },
      include: { branch: true },
    });
    if (!warehouse) throw new UserError("المخزن غير صحيح");

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

    if (data.customerId) {
      const c = await prisma.customer.findFirst({
        where: { id: data.customerId, companyId },
      });
      if (!c) throw new UserError("العميل غير موجود");
    }

    const ids = [...new Set(data.items.map((i) => i.productId))];
    const products = await prisma.product.findMany({
      where: { id: { in: ids }, companyId },
    });
    if (products.length !== ids.length) throw new UserError("منتج غير موجود");
    const byId = new Map(products.map((p) => [p.id, p]));

    const round = (x: Prisma.Decimal) => x.toDecimalPlaces(cur.decimals);
    const baseRound = (x: Prisma.Decimal) => x.toDecimalPlaces(baseCur.decimals);

    const lines = data.items.map((i) => {
      const p = byId.get(i.productId)!;
      return {
        productId: p.id,
        name: p.name,
        quantity: i.quantity,
        unitPrice: D(i.unitPrice),
        unitCost: p.costPrice,
        lineTotal: round(D(i.unitPrice).mul(i.quantity)),
      };
    });

    const subtotal = sum(lines.map((l) => l.lineTotal));
    const dv = D(data.discountValue);
    let discountAmount = D(0);
    if (data.discountType === "PERCENT") {
      const pct = dv.gt(100) ? D(100) : dv;
      discountAmount = round(subtotal.mul(pct).div(100));
    } else if (data.discountType === "FIXED") {
      discountAmount = round(dv.gt(subtotal) ? subtotal : dv);
    }
    const total = subtotal.sub(discountAmount);
    if (total.lte(0)) throw new UserError("إجمالي الفاتورة يجب أن يكون أكبر من صفر");

    const payments = data.payments
      .map((p) => ({ method: p.method, amount: round(D(p.amount)) }))
      .filter((p) => p.amount.gt(0));
    const paid = sum(payments.map((p) => p.amount));
    if (paid.gt(total)) throw new UserError("المدفوع أكبر من إجمالي الفاتورة");
    const balance = total.sub(paid);
    if (balance.gt(0) && !data.customerId) {
      throw new UserError("اختر عميلاً للبيع الآجل");
    }

    // مبالغ القيد بالعملة الأساسية
    const baseTotal = baseRound(total.mul(rate));
    const basePays = payments.map((p) => baseRound(p.amount.mul(rate)));
    let arBase = baseTotal.sub(sum(basePays));
    if (balance.isZero()) {
      if (basePays.length) {
        basePays[basePays.length - 1] = basePays[basePays.length - 1].add(arBase);
      }
      arBase = D(0);
    } else if (arBase.lte(0)) {
      throw new UserError("خطأ في تقريب المبالغ");
    }
    const cogs = baseRound(
      sum(lines.map((l) => D(l.unitCost).mul(l.quantity)))
    );

    const accounts = await prisma.account.findMany({
      where: {
        companyId,
        code: { in: ["1010", "1020", "1030", "1100", "1200", "4000", "5000"] },
      },
    });
    const acc = (code: string) => {
      const a = accounts.find((x) => x.code === code);
      if (!a) throw new UserError(`الحساب ${code} غير موجود`);
      return a.id;
    };

    const journalLines: {
      accountId: string;
      customerId?: string;
      debit?: Prisma.Decimal;
      credit?: Prisma.Decimal;
    }[] = [];
    payments.forEach((p, i) =>
      journalLines.push({ accountId: acc(METHOD_ACCOUNT[p.method]), debit: basePays[i] })
    );
    if (arBase.gt(0)) {
      journalLines.push({
        accountId: acc("1100"),
        customerId: data.customerId!,
        debit: arBase,
      });
    }
    journalLines.push({ accountId: acc("4000"), credit: baseTotal });
    if (cogs.gt(0)) {
      journalLines.push({ accountId: acc("5000"), debit: cogs });
      journalLines.push({ accountId: acc("1200"), credit: cogs });
    }

    const result = await prisma.$transaction(
      async (tx) => {
        const counter = await tx.documentCounter.upsert({
          where: {
            companyId_branchId_docType: {
              companyId,
              branchId: data.branchId,
              docType: "INVOICE",
            },
          },
          create: { companyId, branchId: data.branchId, docType: "INVOICE", lastNumber: 1 },
          update: { lastNumber: { increment: 1 } },
        });
        const number = `${warehouse.branch.code}-${String(counter.lastNumber).padStart(6, "0")}`;

        for (const l of lines) {
          const r = await tx.warehouseStock.updateMany({
            where: {
              productId: l.productId,
              warehouseId: data.warehouseId,
              quantity: { gte: l.quantity },
            },
            data: { quantity: { decrement: l.quantity } },
          });
          if (r.count === 0) throw new UserError(`الكمية غير كافية: ${l.name}`);
          await tx.product.update({
            where: { id: l.productId },
            data: { quantity: { decrement: l.quantity } },
          });
        }

        const invoice = await tx.invoice.create({
          data: {
            companyId,
            branchId: data.branchId,
            warehouseId: data.warehouseId,
            customerId: data.customerId || null,
            number,
            currency: data.currency,
            exchangeRate: rate,
            subtotal,
            discountType: data.discountType,
            discountValue: data.discountType === "NONE" ? D(0) : dv,
            discountAmount,
            total,
            paidAmount: paid,
            balanceDue: balance,
            notes: data.notes,
            createdByUserId: user.id,
            items: {
              create: lines.map((l) => ({
                productId: l.productId,
                name: l.name,
                quantity: l.quantity,
                unitPrice: l.unitPrice,
                unitCost: l.unitCost,
                lineTotal: l.lineTotal,
              })),
            },
            payments: {
              create: payments.map((p) => ({ method: p.method, amount: p.amount })),
            },
          },
        });

        await tx.journalEntry.create({
          data: {
            companyId,
            branchId: data.branchId,
            description: `فاتورة مبيعات ${number}`,
            sourceType: "INVOICE",
            sourceId: invoice.id,
            createdByUserId: user.id,
            lines: { create: journalLines },
          },
        });

        await tx.auditLog.create({
          data: {
            companyId,
            userId: user.id,
            action: "INVOICE_CREATED",
            entityType: "Invoice",
            entityId: invoice.id,
          },
        });

        return { id: invoice.id, number };
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
