فقهimport Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMembership } from "@/lib/company";

import Sidebar from "@/components/sidebar";
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
  });const allocs = await prisma.receiptAllocation.findMany({
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


  return (<div className="min-h-screen bg-gray-50">
  <Sidebar currentPath="/sales" />
  <main className="ml-64 p-4" dir="rtl">

      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">فواتير المبيعات</h1>
        <Link href="/sales/new" className="rounded-lg bg-purple-600 px-4 py-2 text-white">
          فاتورة جديدة
        </Link>
      </div>
      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-start">
            <tr>
              <th className="p-2 text-start">الرقم</th>
              <th className="p-2 text-start">التاريخ</th>
              <th className="p-2 text-start">العميل</th>
              <th className="p-2 text-start">الإجمالي</th>
              <th className="p-2 text-start">المدفوع</th>
              <th className="p-2 text-start">الآجل</th>
              <th className="p-2 text-start">الحالة</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((i) => (
              <tr key={i.id} className="border-t">
               <td className="p-2 font-medium text-blue-600 hover:underline">
  <Link href={`/sales/${i.id}`}>
    {i.number}
  </Link>
</td>

                <td className="p-2">{i.createdAt.toISOString().slice(0, 10)}</td>
                <td className="p-2">{i.customerId ? names.get(i.customerId) ?? "-" : "نقدي"}</td>
                <td className="p-2">{money(i.total)} {i.currency}</td>
                <td className="p-2">{money(Number(i.paidAmount) + (collected.get(i.id) ?? 0))}</td>
<td className="p-2">{money(Math.max(Number(i.balanceDue) - (collected.get(i.id) ?? 0), 0))}</td>
                <td className="p-2">{i.status}</td>
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
</div>

  );
}
