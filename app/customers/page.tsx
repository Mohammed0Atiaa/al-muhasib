import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMembership } from "@/lib/company";
import Sidebar from "@/components/sidebar";
import { Users, UserPlus, Eye, Edit, ShieldAlert, Trash2 } from "lucide-react";
import CustomerActions from "./customer-actions";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  try {
    const user = await getCurrentUser();
    const membership = await getMembership(user.id);
    const companyId = membership.companyId;

    const customers = await prisma.customer.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
    });

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

    const customersWithTotals = customers.map((customer) => {
      const customerInvoices = allInvoices.filter(
        (inv) => inv.customerId === customer.id && inv.status !== "VOIDED"
      );

      const totalPurchases = customerInvoices.reduce((acc, inv) => acc + Number(inv.total), 0);
      const totalPaid = customerInvoices.reduce((acc, inv) => acc + Number(inv.paidAmount), 0);
      const totalBalance = customerInvoices.reduce((acc, inv) => acc + Number(inv.balanceDue), 0);

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
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Users className="w-7 h-7 text-purple-600" />
                إدارة العملاء
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                عرض بيانات جميع العملاء، المتابعة المالية، والتحكم بالحسابات
              </p>
            </div>
            <Link
              href="/customers/new"
              className="inline-flex items-center gap-2 bg-purple-600 text-white font-bold px-4 py-2.5 rounded-lg hover:bg-purple-700 transition"
            >
              <UserPlus className="w-5 h-5" />
              إنشاء عميل جديد
            </Link>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] text-sm text-right">

                <thead className="bg-gray-50 text-gray-500 border-b">
                  <tr>
                    <th className="p-4">اسم العميل / رقم الحساب</th>
                    <th className="p-4">الهاتف</th>
                    <th className="p-4">إجمالي المشتريات</th>
                    <th className="p-4">المسدد</th>
                    <th className="p-4">المتبقي (الآجل)</th>
                    <th className="p-4">الحالة</th>
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
                    customersWithTotals.map((c: any) => (
                      <tr key={c.id} className={`hover:bg-gray-50 ${c.isBlacklisted ? "bg-red-50/40" : ""}`}>
                        <td className="p-4">
                          <div className="font-bold text-gray-900">{c.name}</div>
                          <div className="text-[10px] text-gray-400">ID: {c.id.slice(-6)}</div>
                        </td>
                        <td className="p-4 text-gray-600 dir-ltr text-right">{c.phone || "-"}</td>
                        <td className="p-4 font-semibold text-gray-800">{c.totalPurchases.toFixed(3)} KWD</td>
                        <td className="p-4 font-semibold text-green-600">{c.totalPaid.toFixed(3)} KWD</td>
                        <td className="p-4 font-semibold">
                          <span
                            className={`px-2 py-1 rounded-md text-xs ${
                              c.totalBalance > 0 ? "bg-red-100 text-red-700 font-bold" : "text-gray-500"
                            }`}
                          >
                            {c.totalBalance.toFixed(3)} KWD
                          </span>
                        </td>
                        <td className="p-4">
                          {c.isBlacklisted ? (
                            <span className="px-2 py-0.5 text-xs bg-red-600 text-white font-bold rounded-md">
                              محظور (قائمة سوداء)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 font-semibold rounded-md">
                              نشط
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          <CustomerActions customer={c} />
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
        <h1 className="text-xl font-bold mb-2">حدث خطأ أثناء تحميل تفاصيل الصفحة:</h1>
        <pre className="bg-white p-4 rounded border border-red-200 text-sm overflow-auto">
          {error?.message || String(error)}
        </pre>
      </div>
    );
  }
}
