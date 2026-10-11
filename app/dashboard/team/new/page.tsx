import Link from "next/link";
import EmployeeForm from "./employee-form";

export const dynamic = "force-dynamic";

export default function NewEmployeePage() {
  return (
    <div className="mx-auto max-w-xl p-4 md:p-6" dir="rtl">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">إضافة موظف جديد</h1>
        <Link href="/dashboard/team" className="text-sm text-purple-600 hover:underline">
          رجوع لقائمة الموظفين
        </Link>
      </div>
      <EmployeeForm />
    </div>
  );
}
