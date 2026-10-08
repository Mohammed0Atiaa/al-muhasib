import Sidebar from "@/components/sidebar";

export default function CustomersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50 flex" dir="rtl">
      {/* القائمة الجانبية هنا مرة واحدة فقط لكل صفحات العملاء */}
      <Sidebar currentPath="/customers" />

      {/* المحتوى يتنقل هنا ومبتعد بمقدار ml-64 دائماً */}
      <div className="flex-1 ml-64 min-w-0 p-4 md:p-8">
        {children}
      </div>
    </div>
  );
}
