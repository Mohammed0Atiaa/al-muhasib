import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMembership } from "@/lib/company";
import Sidebar from "@/components/sidebar";
import CustomerActions from "./customer-actions";
import { Users, UserPlus } from "lucide-react";

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

    return (
      <div className="min-h-screen bg-gray-50 flex" dir="rtl">
        <Sidebar currentPath="/customers" />

        {/* إزاحة mr-64 ثابتة تفصل محتوى الصفحة بالكامل عن السايدبار في جميع الوضعيات */}
        <div className="flex-1 mr-64 min-w-0 p-4 md:p-8">
          <main className="max-w-5xl w-full mx-auto">
            {/* رأس الصفحة */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
              <div>
                <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <Users className="w-6 h-6 text-purple-600" />
                  إدارة العملاء
                </h1>
                <p className="text-xs text-gray-500 mt-1">
                  عرض وإدارة قائمة العملاء وسرعة الوصول لحساباتهم
                </p>
              </div>
              <Link
                href="/customers/new"
                className="inline-flex items-center justify-center gap-2 bg-purple-600 text-white font-medium px-4 py-2 rounded-lg hover:bg-purple-700 transition shadow-sm text-sm"
              >
                <UserPlus className="w-4 h-4" />
                إنشاء عميل جديد
              </Link>
            </div>

            {/* جدول مبسط ومبتعد عن السايدبار */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto w-full">
                <table className="w-full text-sm text-right">
                  <thead className="bg-gray-50 text-gray-600 border-b text-xs">
                    <tr>
                      <th className="py-3 px-4 font-semibold">اسم العميل</th>
                      <th className="py-3 px-4 font-semibold">رقم الموبايل</th>
                      <th className="py-3 px-4 font-semibold text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-xs">
                    {customers.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="py-8 text-center text-gray-400">
                          لا يوجد عملاء مضافين حالياً
                        </td>
                      </tr>
                    ) : (
                      customers.map((c: any) => (
                        <tr key={c.id} className={`hover:bg-gray-50/80 ${c.isBlacklisted ? "bg-red-50/40" : ""}`}>
                          <td className="py-3 px-4">
                            <div className="font-bold text-gray-900 text-sm flex items-center gap-2">
                              {c.name}
                              {c.isBlacklisted && (
                                <span className="px-1.5 py-0.5 text-[9px] bg-red-600 text-white font-bold rounded">
                                  محظور
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-gray-400">ID: {c.id.slice(-6)}</div>
                          </td>
                          <td className="py-3 px-4 text-gray-600 font-mono text-left" dir="ltr">
                            {c.phone || "-"}
                          </td>
                          <td className="py-3 px-4 text-center">
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
      </div>
    );
  } catch (error: any) {
    return (
      <div className="p-8 bg-red-50 min-h-screen text-red-900 mr-64" dir="rtl">
        <h1 className="text-xl font-bold mb-2">حدث خطأ أثناء تحميل الصفحة:</h1>
        <pre className="bg-white p-4 rounded border border-red-200 text-sm overflow-auto">
          {error?.message || String(error)}
        </pre>
      </div>
    );
  }
}
