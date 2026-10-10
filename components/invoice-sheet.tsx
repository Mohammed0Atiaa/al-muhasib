import type { SheetData } from "@/lib/invoice-data";

const METHOD: Record<string, string> = { CASH: "كاش", KNET: "كي نت", CARD: "فيزا" };
const TERMS =
  "البضاعة المباعة لا ترد ولا تستبدل إلا بموجب هذه الفاتورة وخلال المدة المتفق عليها.";

export default function InvoiceSheet({ d }: { d: SheetData }) {
  const f = (n: number) => n.toFixed(d.decimals);

  return (
    <div
      dir="rtl"
      className="relative mx-auto w-full max-w-[210mm] bg-white p-8 text-sm text-gray-900 shadow print:max-w-none print:p-0 print:shadow-none"
    >
      <style>{`@page { size: A4; margin: 12mm; }`}</style>

      {d.status === "VOIDED" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="-rotate-45 text-8xl font-extrabold text-red-600/20">ملغاة</span>
        </div>
      )}

      <div className="flex items-start justify-between border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold">{d.companyName}</h1>
          <p className="text-gray-600">{d.branchName}</p>
        </div>
        <div className="text-left">
          <h2 className="text-xl font-bold">فاتورة مبيعات</h2>
          <p>
            رقم: <span className="font-mono">{d.number}</span>
          </p>
          <p>التاريخ: {d.date}</p>
        </div>
      </div>

      <div className="my-4 rounded border p-3">
        <p className="font-semibold">العميل: {d.customerName ?? "نقدي"}</p>
        {d.customerPhone && (
          <p dir="ltr" className="text-right text-gray-600">
            {d.customerPhone}
          </p>
        )}
      </div>

      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="border p-2 text-start">#</th>
            <th className="border p-2 text-start">الصنف</th>
            <th className="border p-2 text-start">الكمية</th>
            <th className="border p-2 text-start">السعر</th>
            <th className="border p-2 text-start">الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          {d.items.map((i, idx) => (
            <tr key={idx}>
              <td className="border p-2">{idx + 1}</td>
              <td className="border p-2">{i.name}</td>
              <td className="border p-2">{i.quantity}</td>
              <td className="border p-2">{f(i.unitPrice)}</td>
              <td className="border p-2">{f(i.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 flex justify-end">
        <div className="w-64 space-y-1">
          <div className="flex justify-between">
            <span>المجموع</span>
            <span>{f(d.subtotal)}</span>
          </div>
          {d.discountAmount > 0 && (
            <div className="flex justify-between">
              <span>الخصم</span>
              <span>-{f(d.discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between border-t pt-1 text-base font-bold">
            <span>الإجمالي ({d.currency})</span>
            <span>{f(d.total)}</span>
          </div>
          {d.payments.map((p, idx) => (
            <div key={idx} className="flex justify-between text-gray-700">
              <span>مدفوع - {METHOD[p.method] ?? p.method}</span>
              <span>{f(p.amount)}</span>
            </div>
          ))}
          {d.collectedLater > 0 && (
            <div className="flex justify-between text-gray-700">
              <span>سدادات لاحقة</span>
              <span>{f(d.collectedLater)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>إجمالي المدفوع</span>
            <span>{f(d.paid)}</span>
          </div>
          {d.balance > 0 && (
            <div className="flex justify-between font-semibold text-red-700">
              <span>المتبقي (آجل)</span>
              <span>{f(d.balance)}</span>
            </div>
          )}
        </div>
      </div>

      {d.status === "VOIDED" && (
        <p className="mt-4 rounded border border-red-300 bg-red-50 p-2 text-red-700">
          فاتورة ملغاة. السبب: {d.voidReason}
        </p>
      )}
      {d.notes && <p className="mt-4 text-gray-700">ملاحظات: {d.notes}</p>}

      <div className="mt-8 border-t pt-3 text-xs text-gray-600">
        <p>{TERMS}</p>
        <p className="mt-1 text-center">شكراً لتعاملكم معنا</p>
      </div>
    </div>
  );
}
