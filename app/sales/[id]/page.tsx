import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMembership } from "@/lib/company";
import Sidebar from "@/components/sidebar";

export const dynamic = "force-dynamic";

interface PageProps {
  params: { id: string };
}

export default async function SaleDetailPage({ params }: PageProps) {
  const user = await getCurrentUser();
  const membership = await getMembership(user.id);
  const companyId = membership.companyId;

  // جلب تفاصيل الفاتورة مع العلاقات
  const invoice = await prisma.invoice.findFirst({
    where: {
      id: params.id,
      companyId: companyId,
    },
    include: {
      items: true,
      payments: {
        orderBy: { paidAt: "desc" },
      },
      customer: true,
    },
  });

  if (!invoice) {
    notFound();
  }

  // جلب بيانات الفرع والمخزن
  const branch = await prisma.branch.findUnique({
    where: { id: invoice.branchId },
  });

  const warehouse = await prisma.warehouse.findUnique({
    where: { id: invoice.warehouseId },
  });

  const isVoided = invoice.status === "VOIDED";

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar currentPath="/sales" />
      <main className="md:ms-64 p-4 md:p-8" dir="rtl">
        {/* الترويسة وأزرار التحكم السريعة */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">
                فاتورة رقم: {invoice.number}
              </h1>
              <span
                className={`px-3 py-1 text-xs font-semibold rounded-full ${
                  isVoided
                    ? "bg-red-100 text-red-700"
                    : invoice.balanceDue > 0
                    ? "bg-amber-100 text-amber-700"
                    : "bg-green-100 text-green-700"
                }`}
              >
                {isVoided
                  ? "ملغاة"
                  : invoice.balanceDue > 0
                  ? "متبقي آجل"
                  : "مسددة بالكامل"}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              تاريخ الإصدار: {new Date(invoice.createdAt).toLocaleDateString("ar-KW")}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/sales"
              className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              عودة للمبيعات
            </Link>
          </div>
        </div>

        {/* تنبيه إذا كانت الفاتورة ملغاة */}
        {isVoided && (
          <div className="p-4 mb-6 bg-red-50 border border-red-200 rounded-lg text-red-800">
            <p className="font-bold">تم إلغاء هذه الفاتورة</p>
            {invoice.voidReason && (
              <p className="text-sm mt-1">سبب الإلغاء: {invoice.voidReason}</p>
            )}
          </div>
        )}

        {/* شبكة المعلومات الأساسية */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white p-4 rounded-xl border border-gray-200">
            <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">
              بيانات العميل
            </h3>
            <p className="font-bold text-gray-800">
              {invoice.customer?.name || "عميل نقدي"}
            </p>
            {invoice.customer?.phone && (
              <p className="text-sm text-gray-600 dir-ltr text-right mt-1">
                {invoice.customer.phone}
              </p>
            )}
          </div>

          <div className="bg-white p-4 rounded-xl border border-gray-200">
            <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">
              الفرع والمخزن
            </h3>
            <p className="font-bold text-gray-800">
              الفرع: {branch?.name || "الفرع الرئيسي"}
            </p>
            <p className="text-sm text-gray-600 mt-1">
              المخزن: {warehouse?.name || "المخزن الرئيسي"}
            </p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-gray-200">
            <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">
              الملخص المالي
            </h3>
            <div className="flex justify-between text-sm py-1">
              <span className="text-gray-500">الإجمالي:</span>
              <span className="font-bold">{Number(invoice.total).toFixed(3)} {invoice.currency}</span>
            </div>
            <div className="flex justify-between text-sm py-1">
              <span className="text-gray-500">المدفوع:</span>
              <span className="font-bold text-green-600">{Number(invoice.paidAmount).toFixed(3)} {invoice.currency}</span>
            </div>
            <div className="flex justify-between text-sm py-1 border-t mt-1 pt-1">
              <span className="text-gray-500">المتبقي:</span>
              <span className="font-bold text-red-600">{Number(invoice.balanceDue).toFixed(3)} {invoice.currency}</span>
            </div>
          </div>
        </div>

        {/* جدول بنود الفاتورة */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
          <div className="p-4 border-b border-gray-100 bg-gray-50">
            <h2 className="font-bold text-gray-800">الأصناف المباعة</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-gray-50 text-gray-500 border-b">
                <tr>
                  <th className="p-3">اسم المنتج</th>
                  <th className="p-3">الكمية</th>
                  <th className="p-3">سعر الوحدة</th>
                  <th className="p-3">الإجمالي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invoice.items.map((item) => (
                  <tr key={item.id}>
                    <td className="p-3 font-medium text-gray-900">{item.name}</td>
                    <td className="p-3">{item.quantity}</td>
                    <td className="p-3">{Number(item.unitPrice).toFixed(3)} {invoice.currency}</td>
                    <td className="p-3 font-semibold">{Number(item.lineTotal).toFixed(3)} {invoice.currency}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
