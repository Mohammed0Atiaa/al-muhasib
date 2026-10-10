import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

export type SheetData = {
  number: string;
  date: string;
  status: string;
  voidReason: string | null;
  currency: string;
  decimals: number;
  companyName: string;
  branchName: string;
  customerName: string | null;
  customerPhone: string | null;
  items: { name: string; quantity: number; unitPrice: number; lineTotal: number }[];
  subtotal: number;
  discountAmount: number;
  total: number;
  payments: { method: string; amount: number }[];
  collectedLater: number;
  paid: number;
  balance: number;
  notes: string | null;
};

export async function loadInvoiceSheet(
  where: Prisma.InvoiceWhereInput
): Promise<SheetData | null> {
  const inv = await prisma.invoice.findFirst({
    where,
    include: { items: true, payments: true },
  });
  if (!inv) return null;

  const [company, branch, customer, currency, later] = await Promise.all([
    prisma.company.findUnique({ where: { id: inv.companyId } }),
    prisma.branch.findUnique({ where: { id: inv.branchId } }),
    inv.customerId
      ? prisma.customer.findUnique({ where: { id: inv.customerId } })
      : null,
    prisma.currency.findUnique({ where: { code: inv.currency } }),
    prisma.receiptAllocation.aggregate({
      _sum: { amount: true },
      where: { invoiceId: inv.id, receipt: { status: "POSTED" } },
    }),
  ]);

  const collectedLater = Number(later._sum.amount ?? 0);

  return {
    number: inv.number,
    date: inv.createdAt.toLocaleString("en-GB", {
      timeZone: "Asia/Kuwait",
      dateStyle: "short",
      timeStyle: "short",
    }),
    status: inv.status,
    voidReason: inv.voidReason,
    currency: inv.currency,
    decimals: currency?.decimals ?? 3,
    companyName: company?.name ?? "",
    branchName: branch?.name ?? "",
    customerName: customer?.name ?? null,
    customerPhone: customer?.phone ?? null,
    items: inv.items.map((i) => ({
      name: i.name,
      quantity: i.quantity,
      unitPrice: Number(i.unitPrice),
      lineTotal: Number(i.lineTotal),
    })),
    subtotal: Number(inv.subtotal),
    discountAmount: Number(inv.discountAmount),
    total: Number(inv.total),
    payments: inv.payments.map((p) => ({ method: p.method, amount: Number(p.amount) })),
    collectedLater,
    paid: Number(inv.paidAmount) + collectedLater,
    balance: Math.max(Number(inv.balanceDue) - collectedLater, 0),
    notes: inv.notes,
  };
}
