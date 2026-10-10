export default function SuspendedPage() {
  return (
    <div dir="rtl" className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div className="max-w-md rounded-xl border bg-white p-8 text-center shadow-sm">
        <h1 className="mb-2 text-xl font-bold text-gray-900">الحساب غير متاح</h1>
        <p className="text-gray-600">
          تم تعليق حساب شركتكم أو إيقافه. يرجى التواصل مع إدارة المنصة.
        </p>
      </div>
    </div>
  );
}
