import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMembership } from "@/lib/company";
import Sidebar from "@/components/sidebar";
import { Users, FileText } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  try {
    const user = await getCurrentUser();
    const membership = await getMembership(user.id);
    const companyId = membership.companyId;

    // 1. جلب العملاء
    const customers = await prisma.customer.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
    });

    // 2. جلب جميع فواتير الشركة
    const allInvoices = await prisma.invoice.findMany({
      where: { companyId },
      select: {
        customerId: true,
        total: true,
        paidAmount: true,
        balanceDue: true,
        status: true,
      },
    });

    // 3. حساب إحصائيات كل عميل
    const customersWithTotals = customers.map((customer) => {
      const customerInvoices = allInvoices.filter(
        (inv) => inv.customerId === customer.id && inv.status !== "VOIDED"
      );

      const totalPurchases = customerInvoices.reduce(
        (acc, inv) => acc + Number(inv.total),
        0
      );
      const totalPaid = customerInvoices.reduce(
        (acc, inv) => acc + Number(inv.paidAmount),
        0
      );
      const totalBalance = customerInvoices.reduce(
        (acc, inv) => acc + Number(inv.balanceDue),
        0
      );

      return {
        ...customer,
        invoicesCount: customerInvoices.length,
        totalPurchases,
        totalPaid,
        totalBalance,
      };
    });

    return (
      <div className="min-h-screen bg-gray-50">
        <Sidebar currentPath="/customers" />
        <main className="md:ms-64 p-4 md:p-8" dir="rtl">
          {/* الترويسة */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Users className="w-7 h-7 text-purple-600" />
                إدارة العملاء
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                قائمة بجميع العملاء ومتابعة الحسابات والفواتير الآجلة
              </p>
            </div>
          </div>

          {/* جدول العملاء */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right">
                <thead className="bg-gray-50 text-gray-500 border-b">
                  <tr>
                    <th className="p-4">اسم العميل</th>
                    <th className="p-4">رقم الهاتف</th>
                    <th className="p-4">عدد الفواتير</th>
                    <th className="p-4">إجمالي المشتريات</th>
                    <th className="p-4">المسدد</th>
                    <th className="p-4">المتبقي (الآجل)</th>
                    <th className="p-4 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {customersWithTotals.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-gray-400">
                        لا يوجد عملاء مضافين حالياً
                      </td>
                    </tr>
                  ) : (
                    customersWithTotals.map((customer) => (
                      <tr key={customer.id} className="hover:bg-gray-50">
                        <td className="p-4 font-bold text-gray-900">{customer.name}</td>
                        <td className="p-4 text-gray-600 dir-ltr text-right">
                          {customer.phone || "-"}
                        </td>
                        <td className="p-4 text-gray-600">{customer.invoicesCount} فاتورة</td>
                        <td className="p-4 font-semibold text-gray-800">
                          {customer.totalPurchases.toFixed(3)} KWD
                        </td>
                        <td className="p-4 font-semibold text-green-600">
                          {customer.totalPaid.toFixed(3)} KWD
                        </td>
                        <td className="p-4 font-semibold">
                          <span
                            className={`px-2 py-1 rounded-md text-xs ${
                              customer.totalBalance > 0
                                ? "bg-red-100 text-red-700 font-bold"
                                : "text-gray-500"
                            }`}
                          >
                            {customer.totalBalance.toFixed(3)} KWD
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <Link
                            href={`/customers/${customer.id}`}
                            className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            كشف الحساب
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    );
  } catch (error: any) {
    return (
      <div className="p-8 bg-red-50 min-h-screen text-red-900" dir="rtl">
        <h1 className="text-xl font-bold mb-2">حدث خطأ أثناء تحميل صفحة العملاء:</h1>
        <pre className="bg-white p-4 rounded border border-red-200 text-sm overflow-auto">
          {error?.message || String(error)}
        </pre>
      </div>
    );
  }
}
