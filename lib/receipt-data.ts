import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { allocatedByInvoice } from "./allocations";
export type ReceiptData = {
  number: string;
  date: string;
  companyName: string;
  branchName: string;
  customerName: string;
  customerPhone: string | null;
  method: string;
  currency: string;
  decimals: number;
  amount: number;
  notes: string | null;
  allocations: { invoiceNumber: string; amount: number }[];
  customerBalance: number;
};

export async function loadReceiptSheet(
  where: Prisma.ReceiptVoucherWhereInput
): Promise<ReceiptData | null> {
  const r = await prisma.receiptVoucher.findFirst({
    where,
    include: { allocations: true },
  });
  if (!r) return null;

  const [company, branch, customer, currency, invoices, open] = await Promise.all([
    prisma.company.findUnique({ where: { id: r.companyId } }),
    prisma.branch.findUnique({ where: { id: r.branchId } }),
    prisma.customer.findUnique({ where: { id: r.customerId } }),
    prisma.currency.findUnique({ where: { code: r.currency } }),
    prisma.invoice.findMany({
      where: { id: { in: r.allocations.map((a) => a.invoiceId) } },
      select: { id: true, number: true },
    }),
    prisma.invoice.findMany({
      where: {
        companyId: r.companyId,
        customerId: r.customerId,
        currency: r.currency,
        status: "POSTED",
        balanceDue: { gt: 0 },
      },
      select: { id: true, balanceDue: true },
    }),
  ]);const doneMap = await allocatedByInvoice(open.map((o) => o.id));
  const customerBalance = open.reduce(
    (s, o) => s + Math.max(Number(o.balanceDue) - (doneMap.get(o.id) ?? 0), 0),
    0
  );
  const numById = new Map(invoices.map((i) => [i.id, i.number]));

  return {
    number: r.number,
    date: r.createdAt.toLocaleString("en-GB", {
      timeZone: "Asia/Kuwait",
      dateStyle: "short",
      timeStyle: "short",
    }),
    companyName: company?.name ?? "",
    branchName: branch?.name ?? "",
    customerName: customer?.name ?? "-",
    customerPhone: customer?.phone ?? null,
    method: r.method,
    currency: r.currency,
    decimals: currency?.decimals ?? 3,
    amount: Number(r.amount),
    notes: r.notes,
    allocations: r.allocations.map((a) => ({
      invoiceNumber: numById.get(a.invoiceId) ?? "-",
      amount: Number(a.amount),
    })),
    customerBalance,
  };
}
