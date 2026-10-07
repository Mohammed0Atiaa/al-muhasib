import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMembership } from "@/lib/company";
import InvoiceForm from "./invoice-form";

export const dynamic = "force-dynamic";

export default async function NewSalePage() {
  const user = await getCurrentUser();
  const membership = await getMembership(user.id);
  const companyId = membership.companyId;

  const [company, branches, products, customers, currencies, rates] =
    await Promise.all([
      prisma.company.findUniqueOrThrow({ where: { id: companyId } }),
      prisma.branch.findMany({
        where: {
          companyId,
          isActive: true,
          ...(membership.branchId ? { id: membership.branchId } : {}),
        },
        include: { warehouses: true },
        orderBy: { name: "asc" },
      }),
      prisma.product.findMany({
        where: { companyId },
        include: { stocks: true },
        orderBy: { name: "asc" },
      }),
      prisma.customer.findMany({ where: { companyId }, orderBy: { name: "asc" } }),
      prisma.currency.findMany(),
      prisma.exchangeRate.findMany({
        where: { companyId, effectiveDate: { lte: new Date() } },
        orderBy: { effectiveDate: "desc" },
      }),
    ]);

  const latestRate = new Map<string, number>();
  for (const r of rates) {
    if (!latestRate.has(r.currency)) latestRate.set(r.currency, Number(r.rate));
  }

  return (
    <div className="mx-auto max-w-3xl p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">فاتورة مبيعات جديدة</h1>
        <Link href="/sales" className="text-sm text-purple-600">
          قائمة الفواتير
        </Link>
      </div>
      <InvoiceForm
        baseCurrency={company.baseCurrency}
        branches={branches.map((b) => ({
          id: b.id,
          name: b.name,
          warehouses: b.warehouses.map((w) => ({ id: w.id, name: w.name })),
        }))}
        customers={customers.map((c) => ({ id: c.id, name: c.name }))}
        currencies={currencies.map((c) => ({
          code: c.code,
          decimals: c.decimals,
          rate:
            c.code === company.baseCurrency ? 1 : latestRate.get(c.code) ?? null,
        }))}
        products={products.map((p) => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          price: Number(p.price),
          stocks: Object.fromEntries(p.stocks.map((s) => [s.warehouseId, s.quantity])),
        }))}
      />
    </div>
  );
}
