import type { ReceiptData } from "@/lib/receipt-data";

const METHOD: Record<string, string> = { CASH: "كاش", KNET: "كي نت", CARD: "فيزا" };

export default function ReceiptSheet({ d }: { d: ReceiptData }) {
  const f = (n: number) => n.toFixed(d.decimals);

  return (
    <div
      dir="rtl"
      className="mx-auto w-full max-w-[210mm] bg-white p-6 text-sm text-gray-900 shadow md:p-8 print:max-w-none print:p-0 print:shadow-none"
    >
      <style>{`@page { size: A4; margin: 12mm; }`}</style>

      <div className="flex items-start justify-between border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold">{d.companyName}</h1>
          <p className="text-gray-600">{d.branchName}</p>
        </div>
        <div className="text-left">
          <h2 className="text-xl font-bold">سند قبض</h2>
          <p>
            رقم: <span className="font-mono">{d.number}</span>
          </p>
          <p>التاريخ: {d.date}</p>
        </div>
      </div>

      <div className="my-4 space-y-2 rounded border p-4">
        <p>
          استلمنا من السيد/ة: <b>{d.customerName}</b>
        </p>
        {d.customerPhone && (
          <p dir="ltr" className="text-right text-gray-600">
            {d.customerPhone}
          </p>
        )}
        <p className="text-lg">
          مبلغ وقدره:{" "}
          <b>
            {f(d.amount)} {d.currency}
          </b>
        </p>
        <p>طريقة الدفع: {METHOD[d.method] ?? d.method}</p>
        {d.notes && <p className="text-gray-700">ملاحظات: {d.notes}</p>}
      </div>

      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="border p-2 text-start">الفاتورة المسددة</th>
            <th className="border p-2 text-start">المبلغ</th>
          </tr>
        </thead>
        <tbody>
          {d.allocations.map((a, i) => (
            <tr key={i}>
              <td className="border p-2">{a.invoiceNumber}</td>
              <td className="border p-2">{f(a.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 flex justify-between rounded bg-gray-50 p-3 font-semibold">
        <span>الرصيد المتبقي على العميل</span>
        <span>
          {f(d.customerBalance)} {d.currency}
        </span>
      </div>

      <div className="mt-12 flex justify-between text-center text-xs text-gray-600">
        <div className="w-40 border-t pt-2">المستلم</div>
        <div className="w-40 border-t pt-2">المسلِّم (العميل)</div>
      </div>
    </div>
  );
}
