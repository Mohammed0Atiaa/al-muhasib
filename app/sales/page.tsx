import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

interface SalesPageProps {
  searchParams: { q?: string };
}

export default async function SalesListPage({ searchParams }: SalesPageProps) {
  const query = searchParams.q?.trim() || "";

  // البحث في الفواتير برقم الفاتورة أو بيانات العميل (اسم/هاتف)
  const invoices = await prisma.invoice.findMany({
    where: query
      ? {
          OR: [
            { number: { contains: query, mode: "insensitive" } },
            {
              customer: {
                OR: [
                  { name: { contains: query, mode: "insensitive" } },
                  { phone: { contains: query, mode: "insensitive" } },
                ],
              },
            },
          ],
        }
      : undefined,
    include: {
      customer: true,
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="p-6 max-w-7xl mx-auto" dir="rtl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">سجل الفواتير والمبيعات</h1>
          <p className="text-sm text-gray-500 mt-1">البحث عن الفواتير وإدارتها أو إلغاؤها</p>
        </div>

        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium transition"
        >
          <span>🏠</span>
          <span>الرئيسية</span>
        </Link>
      </div>

      {/* حقل البحث برقم الفاتورة أو رقم الهاتف */}
      <form method="GET" className="mb-6 bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex gap-3">
        <input
          type="text"
          name="q"
          defaultValue={query}
          placeholder="ابحث برقم الفاتورة، اسم العميل، أو رقم الهاتف..."
          className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
        />
        <button
          type="submit"
          className="px-5 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition"
        >
          بحث
        </button>
        {query && (
          <Link
            href="/sales"
            className="px-4 py-2.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200 transition flex items-center"
          >
            إلغاء البحث
          </Link>
        )}
      </form>

      {/* جدول الفواتير */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <table className="w-full text-sm text-right">
          <thead className="bg-gray-50 text-gray-600 border-b">
            <tr>
              <th className="p-3.5">رقم الفاتورة</th>
              <th className="p-3.5">العميل</th>
              <th className="p-3.5">رقم الهاتف</th>
              <th className="p-3.5">التاريخ</th>
              <th className="p-3.5">الحالة</th>
              <th className="p-3.5">الإجمالي</th>
              <th className="p-3.5 text-center">الإجراء</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {invoices.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-gray-500">
                  لا توجد فواتير مطابقة للبحث.
                </td>
              </tr>
            ) : (
              invoices.map((inv) => {
                const isVoid = inv.status === "VOIDED";
                return (
                  <tr key={inv.id} className="hover:bg-gray-50">
                    <td className="p-3.5 font-bold text-gray-900">{inv.number}</td>
                    <td className="p-3.5">{inv.customer?.name || "عميل نقدي"}</td>
                    <td className="p-3.5 dir-ltr text-right">{inv.customer?.phone || "-"}</td>
                    <td className="p-3.5 text-gray-500">
                      {new Date(inv.createdAt).toLocaleDateString("ar-KW")}
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                          isVoid
                            ? "bg-red-100 text-red-700"
                            : "bg-green-100 text-green-700"
                        }`}
                      >
                        {isVoid ? "ملغاة" : "نشطة"}
                      </span>
                    </td>
                    <td className="p-3.5 font-semibold">
                      {Number(inv.total).toFixed(3)} KWD
                    </td>
                    <td className="p-3.5 text-center">
                      <Link
                        href={`/sales/${inv.id}`}
                        className="inline-flex items-center gap-1 text-purple-600 hover:text-purple-800 font-medium text-xs bg-purple-50 px-3 py-1.5 rounded-md border border-purple-100"
                      >
                        عرض التفاصيل والإلغاء 🔍
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
  );
}
