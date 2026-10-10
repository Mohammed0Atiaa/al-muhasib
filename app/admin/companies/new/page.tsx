import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { MAX_COMPANIES, requirePlatformAdmin } from "@/lib/platform";
import CompanyForm from "./company-form";

export const dynamic = "force-dynamic";

export default async function NewCompanyPage() {
  await requirePlatformAdmin();
  const used = await prisma.company.count({ where: { status: { not: "DELETED" } } });

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-bold">إنشاء شركة جديدة</h1>
        <Link href="/admin/companies" className="text-sm text-purple-600">
          رجوع
        </Link>
      </div>
      {used >= MAX_COMPANIES ? (
        <p className="rounded-lg bg-amber-50 p-4 text-amber-800">
          وصلت للحد الأقصى ({MAX_COMPANIES} شركات).
        </p>
      ) : (
        <CompanyForm />
      )}
    </div>
  );
}
