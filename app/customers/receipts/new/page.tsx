import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMembership } from "@/lib/company";
import ReceiptForm from "./receipt-form";

export const dynamic = "force-dynamic";

export default async function NewReceiptPage() {
  const user = await getCurrentUser();
  const membership = await getMembership(user.id);
  const companyId = membership.companyId;

  const [branches, currencies, open] = await Promise.all([
    prisma.branch.findMany({
      where: {
        companyId,
        isActive: true,
        ...(membership.branchId ? { id: membership.branchId } : {}),
      },
      orderBy: { name: "asc" },
    }),
    prisma.currency.findMany(),
    prisma.invoice.findMany({
      where: {
        companyId,
        status: "POSTED",
        balanceDue: { gt: 0 },
        customerId: { not: null },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const done = await prisma.receiptAllocation.groupBy({
    by: ["invoiceId"],
    where: {
      invoiceId: { in: open.map((i) => i.id) },
      receipt: { status: "POSTED" },
    },
    _sum: { amount: true },
  });
  const doneMap = new Map(done.map((d) => [d.invoiceId, Number(d._sum.amount ?? 0)]));

  const invoices = open
    .map((i) => ({
      id: i.id,
      number: i.number,
      customerId: i.customerId as string,
      currency: i.currency,
      remaining: Number(i.balanceDue) - (doneMap.get(i.id) ?? 0),
    }))
    .filter((i) => i.remaining > 0);

  const customers = await prisma.customer.findMany({
    where: { id: { in: [...new Set(invoices.map((i) => i.customerId))] } },
    orderBy: { name: "asc" },
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ضع هنا <Sidebar currentPath="/customers/receipts/new" /> */}
      <main className="ml-64 p-4" dir="rtl">
        <div className="mx-auto max-w-xl">
          <h1 className="mb-4 text-2xl font-bold">سند قبض جديد</h1>
          <ReceiptForm
            branches={branches.map((b) => ({ id: b.id, name: b.name }))}
            customers={customers.map((c) => ({ id: c.id, name: c.name }))}
            invoices={invoices}
            decimals={Object.fromEntries(currencies.map((c) => [c.code, c.decimals]))}
          />
        </div>
      </main>
    </div>
  );
}
