import Link from "next/link";
import EmployeeForm from "./employee-form";

export const dynamic = "force-dynamic";

export default function NewEmployeePage() {
  return (
    <div className="mx-auto max-w-xl p-4 md:p-6" dir="rtl">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">إضافة موظف جديد</h1>
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="rounded-lg border bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 shadow-sm">
            الرئيسية
          </Link>
          <Link href="/dashboard/team" className="text-xs font-medium text-purple-600 hover:underline">
            قائمة الموظفين
          </Link>
        </div>
      </div>
      <EmployeeForm />
    </div>
  );
}
