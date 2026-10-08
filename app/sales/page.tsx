import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMembership } from "@/lib/company";

export const dynamic = "force-dynamic";

export default async function SalesPage() {
  const user = await getCurrentUser();
  const { companyId } = await getMembership(user.id);

  const invoices = await prisma.invoice.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const customerIds = [
    ...new Set(invoices.map((i) => i.customerId).filter((x): x is string => !!x)),
  ];
  const customers = await prisma.customer.findMany({
    where: { id: { in: customerIds } },
  });
  const names = new Map(customers.map((c) => [c.id, c.name]));

  const allocs = await prisma.receiptAllocation.findMany({
    where: {
      invoiceId: { in: invoices.map((i) => i.id) },
      receipt: { status: "POSTED" },
    },
    select: {
      invoiceId: true,
      amount: true,
    },
  });

  const collected = new Map<string, number>();
  allocs.forEach((a) => {
    const current = collected.get(a.invoiceId) || 0;
    collected.set(a.invoiceId, current + Number(a.amount));
  });

  const money = (v: unknown) =>
    Number(v).toLocaleString("en", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 3,
    });

  return (
    <main dir="rtl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">فواتير المبيعات</h1>
        <Link
          href="/sales/new"
          className="rounded-lg bg-purple-600 px-4 py-2 text-white hover:bg-purple-700 transition"
        >
          فاتورة جديدة
        </Link>
      </div>
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm text-right">
          <thead className="bg-gray-50 text-gray-500 border-b">
            <tr>
              <th className="p-3">الرقم</th>
              <th className="p-3">التاريخ</th>
              <th className="p-3">العميل</th>
              <th className="p-3">الإجمالي</th>
              <th className="p-3">المدفوع</th>
              <th className="p-3">الآجل</th>
              <th className="p-3">الحالة</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {invoices.map((i) => (
              <tr key={i.id} className="hover:bg-gray-50">
                <td className="p-3 font-medium text-blue-600 hover:underline">
                  <Link href={`/sales/${i.id}`}>{i.number}</Link>
                </td>
                <td className="p-3 text-gray-600">{i.createdAt.toISOString().slice(0, 10)}</td>
                <td className="p-3 font-medium text-gray-900">
                  {i.customerId ? names.get(i.customerId) ?? "-" : "نقدي"}
                </td>
                <td className="p-3 font-semibold">
                  {money(i.total)} {i.currency}
                </td>
                <td className="p-3 text-green-600 font-medium">
                  {money(Number(i.paidAmount) + (collected.get(i.id) ?? 0))}
                </td>
                <td className="p-3 text-amber-600 font-medium">
                  {money(
                    Math.max(Number(i.balanceDue) - (collected.get(i.id) ?? 0), 0)
                  )}
                </td>
                <td className="p-3">
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${i.status === 'POSTED' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                    {i.status}
                  </span>
                </td>
              </tr>
            ))}
            {invoices.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-gray-500">
                  لا توجد فواتير بعد
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
