import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { MAX_COMPANIES, requirePlatformAdmin } from "@/lib/platform";
import CompanyActions from "./company-actions";

export const dynamic = "force-dynamic";

export default async function CompaniesPage() {
  await requirePlatformAdmin();
  const companies = await prisma.company.findMany({
    where: { status: { not: "DELETED" } },
    orderBy: { createdAt: "desc" },
  });
  const full = companies.length >= MAX_COMPANIES;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">الشركات</h1>
          <p className="text-sm text-gray-500">
            {companies.length} من {MAX_COMPANIES} شركات
          </p>
        </div>
        {full ? (
          <span className="rounded-lg bg-gray-200 px-4 py-2 text-sm text-gray-500">
            وصلت للحد الأقصى
          </span>
        ) : (
          <Link
            href="/admin/companies/new"
            className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white"
          >
            إنشاء شركة جديدة
          </Link>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="p-3 text-start">الشركة</th>
              <th className="p-3 text-start">الهاتف</th>
              <th className="p-3 text-start">الحالة</th>
              <th className="p-3 text-start">الإجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {companies.map((c) => (
              <tr key={c.id} className={c.status === "SUSPENDED" ? "bg-amber-50/50" : ""}>
                <td className="p-3">
                  <div className="font-bold text-gray-900">{c.name}</div>
                  <div className="text-xs text-gray-500">
                    {c.country ?? "-"} {c.email ? `· ${c.email}` : ""}
                  </div>
                </td>
                <td className="p-3" dir="ltr">
                  <span className="block text-right">{c.phone ?? "-"}</span>
                </td>
                <td className="p-3">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      c.status === "SUSPENDED"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-green-100 text-green-700"
                    }`}
                  >
                    {c.status === "SUSPENDED" ? "معلّقة" : "نشطة"}
                  </span>
                </td>
                <td className="p-3">
                  <CompanyActions id={c.id} name={c.name} status={c.status} />
                </td>
              </tr>
            ))}
            {companies.length === 0 && (
              <tr>
                <td colSpan={4} className="p-8 text-center text-gray-400">
                  لا توجد شركات بعد
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
