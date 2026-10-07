import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMembership } from "@/lib/company";
import Sidebar from "@/components/sidebar";
import { ArrowRight, FileText, Phone, User } from "lucide-react";

export const dynamic = "force-dynamic";

interface PageProps {
  params: { id: string };
}

export default async function CustomerDetailPage({ params }: PageProps) {
  try {
    const user = await getCurrentUser();
    const membership = await getMembership(user.id);
    const companyId = membership.companyId;

    // جلب بيانات العميل
    const customer = await prisma.customer.findFirst({
      where: {
        id: params.id,
        companyId: companyId,
      },
    });

    if (!customer) {
      notFound();
    }

    // جلب فواتير العميل
    const invoices = await prisma.invoice.findMany({
      where: {
        customerId: customer.id,
        companyId: companyId,
      },
      orderBy: { createdAt: "desc" },
    });

    // حساب الإحصائيات المالية للعميل
    const activeInvoices = invoices.filter((inv) => inv.status !== "VOIDED");
    const totalPurchases = activeInvoices.reduce((acc, inv) => acc + Number(inv.total), 0);
    const totalPaid = activeInvoices.reduce((acc, inv) => acc + Number(inv.paidAmount), 0);
    const totalBalance = activeInvoices.reduce((acc, inv) => acc + Number(inv.balanceDue), 0);

    return (
      <div className="min-h-screen bg-gray-50">
        <Sidebar currentPath="/customers" />
        <main className="md:ms-64 p-4 md:p-8" dir="rtl">
          {/* الترويسة وأزرار التنقل */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <Link
                href="/customers"
                className="p-2 text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                <ArrowRight className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <User className="w-6 h-6 text-purple-600" />
                  {customer.name}
                </h1>
                {customer.phone && (
                  <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5" />
                    <span className="dir-ltr text-right">{customer.phone}</span>
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* ملخص الحساب المالي للعميل */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
              <span className="text-xs font-semibold text-gray-400 uppercase">
                إجمالي المشتريات
              </span>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {totalPurchases.toFixed(3)} KWD
              </p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
              <span className="text-xs font-semibold text-gray-400 uppercase">
                إجمالي المدفوعات
              </span>
              <p className="text-2xl font-bold text-green-600 mt-2">
                {totalPaid.toFixed(3)} KWD
              </p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
              <span className="text-xs font-semibold text-gray-400 uppercase">
                الرصيد المتبقي (الآجل)
              </span>
              <p className={`text-2xl font-bold mt-2 ${totalBalance > 0 ? "text-red-600" : "text-gray-700"}`}>
                {totalBalance.toFixed(3)} KWD
              </p>
            </div>
          </div>

          {/* سجل فواتير العميل */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <h2 className="font-bold text-gray-800 flex items-center gap-2">
                <FileText className="w-5 h-5 text-gray-500" />
                سجل الفواتير الخاصة بالعميل
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right">
                <thead className="bg-gray-50 text-gray-500 border-b">
                  <tr>
                    <th className="p-4">رقم الفاتورة</th>
                    <th className="p-4">التاريخ</th>
                    <th className="p-4">الإجمالي</th>
                    <th className="p-4">المدفوع</th>
                    <th className="p-4">المتبقي</th>
                    <th className="p-4">الحالة</th>
                    <th className="p-4 text-center">عرض</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {invoices.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-gray-400">
                        لا توجد فواتير مسجلة لهذا العميل
                      </td>
                    </tr>
                  ) : (
                    invoices.map((invoice) => {
                      const isVoided = invoice.status === "VOIDED";
                      return (
                        <tr key={invoice.id} className="hover:bg-gray-50">
                          <td className="p-4 font-bold text-gray-900">#{invoice.number}</td>
                          <td className="p-4 text-gray-600">
                            {new Date(invoice.createdAt).toLocaleDateString("ar-KW")}
                          </td>
                          <td className="p-4 font-semibold">{Number(invoice.total).toFixed(3)} {invoice.currency}</td>
                          <td className="p-4 font-semibold text-green-600">{Number(invoice.paidAmount).toFixed(3)} {invoice.currency}</td>
                          <td className="p-4 font-semibold text-red-600">{Number(invoice.balanceDue).toFixed(3)} {invoice.currency}</td>
                          <td className="p-4">
                            <span
                              className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                                isVoided
                                  ? "bg-red-100 text-red-700"
                                  : Number(invoice.balanceDue) > 0
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-green-100 text-green-700"
                              }`}
                            >
                              {isVoided
                                ? "ملغاة"
                                : Number(invoice.balanceDue) > 0
                                ? "متبقي آجل"
                                : "مسددة بالكامل"}
                            </span>
                          </td>
                          <td className="p-4 text-center">
                            <Link
                              href={`/sales/${invoice.id}`}
                              className="text-xs font-semibold text-purple-600 hover:underline"
                            >
                              عرض الفاتورة
                            </Link>
                          </td>
                        </tr>
                      );
                    })
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
        <h1 className="text-xl font-bold mb-2">حدث خطأ أثناء تحميل تفاصيل العميل:</h1>
        <pre className="bg-white p-4 rounded border border-red-200 text-sm overflow-auto">
          {error?.message || String(error)}
        </pre>
      </div>
    );
  }
}
