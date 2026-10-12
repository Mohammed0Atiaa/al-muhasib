import type { ReactNode } from "react";
import Sidebar from "@/components/sidebar";

export default function ReportShell({
  currentPath,
  children,
}: {
  currentPath: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50 print:bg-white">
      <div className="print:hidden">
        <Sidebar currentPath={currentPath} />
      </div>
      <main dir="rtl" className="ml-64 p-4 md:p-8 print:ml-0 print:p-0">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}

export function NoAccess() {
  return (
    <div
      dir="rtl"
      className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-800"
    >
      <p className="mb-1 font-bold">غير مصرح</p>
      <p className="text-sm">
        التقارير المالية متاحة للمدير والمدير المساعد والمحاسب فقط.
      </p>
    </div>
  );
}
