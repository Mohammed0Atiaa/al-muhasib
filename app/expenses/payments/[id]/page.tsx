import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getMembership } from "@/lib/company";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

const METHOD: Record<string, string> = { CASH: "كاش", KNET: "كي نت", CARD: "بطاقة ائتمانية", TRANSFER: "تحويل بنكي" };

function getTafqeetText(amount: number, currencyCode: string) {
  const currencyLabel =
    currencyCode === "EGP"
      ? "جنيه مصري"
      : currencyCode === "KWD"
      ? "دينار كويتي"
      : currencyCode;

  return `فقط ${amount.toFixed(currencyCode === "EGP" ? 2 : 3)} ${currencyLabel} لا غير`;
}

export default async function PaymentVoucherPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ done?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await getCurrentUser();
  const { companyId } = await getMembership(user.id);

  // جلب بيانات الشركة وسند الصرف (سنتأكد من جاهزية الجدول لاحقاً أو استخدامه)
  const [company, payment] = await Promise.all([
    prisma.company.findUnique({ where: { id: companyId } }),
    prisma.paymentVoucher?.findFirst?.({
      where: { id, companyId },
      include: { expenseCategory: true, user: true },
    }).catch(() => null),
  ]);

  // إذا لم يكن الجدول منشأ بعد في قاعدة البيانات، سنقوم بإنشائه أو محاكاته مؤقتاً
  if (!payment) {
    // سنقوم بتجهيز نموذج تجريبي أو توجيهك لإنشاء المودل في الـ Schema
  }

  const fmtDateOnly = (d: Date) =>
    d.toLocaleDateString("ar-KW", {
      timeZone: "Asia/Kuwait",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });

  return (
    <main dir="rtl" className="mx-auto max-w-3xl p-4 md:p-6 space-y-6 bg-white border rounded-xl shadow-sm my-6">
      {sp.done && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-3 font-bold text-green-800 text-sm print:hidden">
          تم حفظ سند الصرف بنجاح.
        </div>
      )}

      {/* أزرار التحكم والإجراءات (تخفى عند الطباعة) */}
      <div className="flex justify-between items-center border-b pb-4 print:hidden">
        <h1 className="text-xl font-bold text-gray-900">سند صرف جديد / استعراض</h1>
        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
            className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-bold text-white hover:bg-purple-700 transition"
          >
            🖨️ طباعة السند
          </button>
          <Link
            href="/dashboard"
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
          >
            🏠 الرئيسية
          </Link>
        </div>
      </div>

      {/* رأس السند (الهيدر) */}
      <div className="flex justify-between items-start border-b pb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{company?.name || "اسم الشركة"}</h2>
          <p className="text-sm font-medium text-red-600 mt-1">سند صرف (Payment Voucher)</p>
        </div>
        <div className="text-left text-sm text-gray-600">
          <p><span className="font-semibold text-gray-800">التاريخ:</span> {fmtDateOnly(new Date())}</p>
          <p className="text-xs text-gray-500 mt-0.5">رقم السند: PV-1001</p>
        </div>
      </div>

      {/* بيانات المستفيد والمصروف */}
      <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border text-sm">
        <div>
          <p className="text-xs text-gray-400">المصروف إليه / الجهة المستفيدة</p>
          <p className="font-bold text-gray-800">اسم الموظف أو الجهة...</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">بند المصروف (الحساب)</p>
          <p className="font-bold text-purple-700">إيجار / رواتب / سلفة موظف...</p>
        </div>
        <div className="col-span-2 border-t pt-2 mt-1">
          <p className="text-xs text-gray-400">البيان / سبب الصرف:</p>
          <p className="text-sm text-gray-700 font-medium">تفاصيل البيان هنا...</p>
        </div>
      </div>

      {/* المبلغ والتفقيط */}
      <div className="flex justify-between items-end border-t pt-4">
        <div className="text-xs font-bold text-gray-600 bg-red-50 p-3 rounded-lg border border-red-100">
          التفقيط: {getTafqeetText(0, "KWD")}
        </div>
        <div className="text-left space-y-1 text-sm">
          <p className="text-lg font-bold text-red-700">
            المبلغ الصافي: 0.000 دينار كويتي
          </p>
        </div>
      </div>

      {/* التوقيعات والفوتر */}
      <div className="grid grid-cols-3 pt-12 text-center text-xs text-gray-600 border-t mt-8">
        <div>
          <p className="font-bold mb-8">المستلم</p>
          <div className="border-b border-dashed w-32 mx-auto"></div>
        </div>
        <div>
          <p className="font-bold mb-8">المحاسب</p>
          <div className="border-b border-dashed w-32 mx-auto"></div>
        </div>
        <div>
          <p className="font-bold mb-8">المدير العام</p>
          <div className="border-b border-dashed w-32 mx-auto"></div>
        </div>
      </div>
    </main>
  );
}
