import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMembership } from "@/lib/company";
import { stackServerApp } from "@/stack/server";
import VoidInvoiceButton from "./void-button";
import InvoiceActions from "./invoice-actions";
import SavedBanner from "./saved-banner";

export const dynamic = "force-dynamic";

interface PageProps {
  params: { id: string };
}

const METHOD: Record<string, string> = { CASH: "كاش", KNET: "كي نت", CARD: "فيزا" };

async function userName(id: string | null) {
  if (!id) return null;
  try {
    const u = await stackServerApp.getUser(id);
    return u?.displayName || u?.primaryEmail || null;
  } catch {
    return null;
  }
}

export default async function SaleDetailPage({ params }: PageProps) {
  try {
    const user = await getCurrentUser();
    const { companyId } = await getMembership(user.id);

    const invoice = await prisma.invoice.findFirst({
      where: { id: params.id, companyId },
      include: { items: true, payments: { orderBy: { paidAt: "desc" } } },
    });
    if (!invoice) notFound();

    const [customer, branch, warehouse, currency, allocations] = await Promise.all([
      invoice.customerId
        ? prisma.customer.findUnique({ where: { id: invoice.customerId } })
        : null,
      prisma.branch.findUnique({ where: { id: invoice.branchId } }),
      prisma.warehouse.findUnique({ where: { id: invoice.warehouseId } }),
      prisma.currency.findUnique({ where: { code: invoice.currency } }),
      prisma.receiptAllocation.findMany({
        where: { invoiceId: invoice.id, receipt: { status: "POSTED" } },
        include: { receipt: true },
        orderBy: { id: "asc" },
      }),
    ]);
    const [createdBy, voidedBy] = await Promise.all([
      userName(invoice.createdByUserId),
      userName(invoice.voidedByUserId),
    ]);

    const dec = currency?.decimals ?? 3;
    const f = (n: unknown) => Number(n).toFixed(dec);
    const fmtDate = (d: Date) =>
      d.toLocaleString("ar-KW", {
        timeZone: "Asia/Kuwait",
        dateStyle: "medium",
        timeStyle: "short",
      });

    const isVoided = invoice.status === "VOIDED";
    const collected = allocations.reduce((s, a) => s + Number(a.amount), 0);
    const paid = Number(invoice.paidAmount) + collected;
    const balance = Math.max(Number(invoice.balanceDue) - collected, 0);

    const card = "rounded-xl border border-gray-200 bg-white p-4 shadow-sm";

    return (
      <main dir="rtl" className="mx-auto max-w-5xl p-3 md:p-6">
        <SavedBanner number={invoice.number} />

        <div className="mb-5 space-y-3 border-b border-gray-200 pb-4">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-bold text-gray-900 md:text-2xl">
              فاتورة رقم: {invoice.number}
            </h1>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                isVoided
                  ? "bg-red-100 text-red-700"
                  : balance > 0
                  ? "bg-amber-100 text-amber-700"
                  : "bg-green-100 text-green-700"
              }`}
            >
              {isVoided ? "ملغاة" : balance > 0 ? "متبقي آجل" : "مسددة بالكامل"}
            </span>
          </div>
          <p className="text-sm text-gray-500">
            تاريخ الإصدار: {fmtDate(invoice.createdAt)}
            {createdBy ? ` — بواسطة: ${createdBy}` : ""}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <InvoiceActions invoiceId={invoice.id} />
            {!isVoided && <VoidInvoiceButton invoiceId={invoice.id} />}
            <Link
              href="/sales"
              className="rounded-lg border border-purple-200 bg-purple-50 px-4 py-2 text-sm font-medium text-purple-700"
            >
              📋 سجل الفواتير
            </Link>
            <Link
              href="/dashboard"
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700"
            >
              🏠 الرئيسية
            </Link>
          </div>
        </div>

        {isVoided && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
            <p className="font-bold">⚠️ هذه الفاتورة ملغاة</p>
            <p className="mt-1 text-sm">
              {voidedBy ? `بواسطة: ${voidedBy}` : ""}
              {invoice.voidedAt ? ` — ${fmtDate(invoice.voidedAt)}` : ""}
            </p>
            {invoice.voidReason && (
              <p className="mt-2 rounded-lg border border-red-100 bg-white p-2.5 text-sm font-medium">
                السبب: {invoice.voidReason}
              </p>
            )}
          </div>
        )}

        <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className={card}>
            <h3 className="mb-2 text-xs font-semibold text-gray-400">بيانات العميل</h3>
            <p className="font-bold text-gray-800">{customer?.name || "عميل نقدي"}</p>
            {customer?.phone && (
              <p dir="ltr" className="mt-1 text-right text-sm text-gray-600">
                {customer.phone}
              </p>
            )}
          </div>

          <div className={card}>
            <h3 className="mb-2 text-xs font-semibold text-gray-400">الفرع والمخزن</h3>
            <p className="font-bold text-gray-800">الفرع: {branch?.name || "-"}</p>
            <p className="mt-1 text-sm text-gray-600">المخزن: {warehouse?.name || "-"}</p>
          </div>

          <div className={card}>
            <h3 className="mb-2 text-xs font-semibold text-gray-400">الملخص المالي</h3>
            <div className="flex justify-between py-1 text-sm">
              <span className="text-gray-500">الإجمالي</span>
              <span className="font-bold">
                {f(invoice.total)} {invoice.currency}
              </span>
            </div>
            {Number(invoice.discountAmount) > 0 && (
              <div className="flex justify-between py-1 text-sm">
                <span className="text-gray-500">الخصم</span>
                <span>{f(invoice.discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between py-1 text-sm">
              <span className="text-gray-500">المدفوع</span>
              <span className="font-bold text-green-600">{f(paid)}</span>
            </div>
            <div className="mt-1 flex justify-between border-t pt-1 text-sm">
              <span className="text-gray-500">المتبقي</span>
              <span className="font-bold text-red-600">{f(balance)}</span>
            </div>
          </div>
        </div>

        <div className="mb-5 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b bg-gray-50 p-4">
            <h2 className="font-bold text-gray-800">الأصناف المباعة</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50 text-gray-500">
                <tr>
                  <th className="p-3 text-start">اسم المنتج</th>
                  <th className="p-3 text-start">الكمية</th>
                  <th className="p-3 text-start">سعر الوحدة</th>
                  <th className="p-3 text-start">الإجمالي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invoice.items.map((item) => (
                  <tr key={item.id}>
                    <td className="p-3 font-medium text-gray-900">{item.name}</td>
                    <td className="p-3">{item.quantity}</td>
                    <td className="p-3">{f(item.unitPrice)}</td>
                    <td className="p-3 font-semibold">{f(item.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mb-6 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b bg-gray-50 p-4">
            <h2 className="font-bold text-gray-800">الدفعات والسدادات</h2>
          </div>
          {invoice.payments.length + allocations.length === 0 ? (
            <p className="p-4 text-sm text-gray-500">لا توجد دفعات</p>
          ) : (
            <ul className="divide-y divide-gray-100 text-sm">
              {invoice.payments.map((p) => (
                <li key={p.id} className="flex justify-between p-3">
                  <span>دفعة عند الإصدار — {METHOD[p.method] ?? p.method}</span>
                  <span className="font-semibold">
                    {f(p.amount)} {invoice.currency}
                  </span>
                </li>
              ))}
              {allocations.map((a) => (
                <li key={a.id} className="flex justify-between p-3">
                  <span>
                    سند قبض{" "}
                    <Link
                      href={`/customers/receipts/${a.receiptId}`}
                      className="text-blue-600 hover:underline"
                    >
                      {a.receipt.number}
                    </Link>{" "}
                    — {METHOD[a.receipt.method] ?? a.receipt.method}
                  </span>
                  <span className="font-semibold">
                    {f(a.amount)} {invoice.currency}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    );
  } catch (error: any) {
    if (typeof error?.digest === "string" && error.digest.startsWith("NEXT_")) {
      throw error;
    }
    return (
      <div className="min-h-screen bg-red-50 p-8 text-red-900" dir="rtl">
        <h1 className="mb-2 text-xl font-bold">حدث خطأ أثناء تحميل تفاصيل الفاتورة:</h1>
        <pre className="overflow-auto rounded border border-red-200 bg-white p-4 text-sm">
          {error?.message || String(error)}
        </pre>
      </div>
    );
  }
}
