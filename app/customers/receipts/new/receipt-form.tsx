"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createReceipt } from "@/lib/actions/receipts";

type Inv = {
  id: string;
  number: string;
  customerId: string;
  currency: string;
  remaining: number;
};

export default function ReceiptForm(props: {
  branches: { id: string; name: string }[];
  customers: { id: string; name: string }[];
  invoices: Inv[];
  decimals: Record<string, number>;
}) {
  const { branches, customers, invoices, decimals } = props;
  const router = useRouter();

  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const [customerId, setCustomerId] = useState("");
  const [currency, setCurrency] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [method, setMethod] = useState<"CASH" | "KNET" | "CARD">("CASH");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const activeCustomer = customers.some((c) => c.id === customerId)
    ? customerId
    : customers[0]?.id ?? "";
  const customerInvoices = invoices.filter((i) => i.customerId === activeCustomer);
  const currencies = [...new Set(customerInvoices.map((i) => i.currency))];
  const activeCurrency = currencies.includes(currency) ? currency : currencies[0] ?? "";
  const list = customerInvoices.filter((i) => i.currency === activeCurrency);
  const activeInvoice = list.some((i) => i.id === invoiceId) ? invoiceId : "";

  const dec = decimals[activeCurrency] ?? 3;
  const outstanding = list
    .filter((i) => !activeInvoice || i.id === activeInvoice)
    .reduce((s, i) => s + i.remaining, 0);

  async function submit() {
    setError("");
    setMessage("");
    setSaving(true);
    const res = await createReceipt({
      branchId,
      customerId: activeCustomer,
      currency: activeCurrency,
      method,
      amount: Number(amount),
      invoiceId: activeInvoice || null,
      notes,
    });
    setSaving(false);
    if (res.ok) {
      setMessage(`تم إصدار السند ${res.number}`);
      setAmount("");
      setNotes("");
      router.refresh();
    } else {
      setError(res.error);
    }
  }

  const field = "w-full rounded-lg border px-3 py-2";

  if (customers.length === 0) {
    return <p className="text-gray-600">لا توجد فواتير آجلة مفتوحة.</p>;
  }

  return (
    <div className="space-y-3">
      <select className={field} value={branchId} onChange={(e) => setBranchId(e.target.value)}>
        {branches.map((b) => (
          <option key={b.id} value={b.id}>{b.name}</option>
        ))}
      </select>
      <select className={field} value={activeCustomer} onChange={(e) => setCustomerId(e.target.value)}>
        {customers.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      <div className="grid grid-cols-2 gap-3">
        <select className={field} value={activeCurrency} onChange={(e) => setCurrency(e.target.value)}>
          {currencies.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select className={field} value={method} onChange={(e) => setMethod(e.target.value as "CASH" | "KNET" | "CARD")}>
          <option value="CASH">كاش</option>
          <option value="KNET">كي نت</option>
          <option value="CARD">فيزا</option>
        </select>
      </div>
      <select className={field} value={activeInvoice} onChange={(e) => setInvoiceId(e.target.value)}>
        <option value="">كل الفواتير المفتوحة (الأقدم أولاً)</option>
        {list.map((i) => (
          <option key={i.id} value={i.id}>
            {i.number} — المتبقي {i.remaining.toFixed(dec)}
          </option>
        ))}
      </select>

      <div className="rounded-lg bg-gray-50 p-3 text-sm">
        المتبقي على العميل: <b>{outstanding.toFixed(dec)} {activeCurrency}</b>
      </div>

      <div className="flex gap-2">
        <input
          type="number"
          step="any"
          className={field}
          placeholder="المبلغ المستلم"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <button
          type="button"
          className="whitespace-nowrap rounded-lg border px-3 text-purple-600"
          onClick={() => setAmount(outstanding.toFixed(dec))}
        >
          سداد كامل
        </button>
      </div>
      <input
        className={field}
        placeholder="ملاحظات (اختياري)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />

      {error && <p className="text-red-600">{error}</p>}
      {message && <p className="text-green-700">{message}</p>}

      <button
        type="button"
        disabled={saving || !Number(amount) || !activeCurrency}
        onClick={submit}
        className="w-full rounded-lg bg-purple-600 py-3 font-semibold text-white disabled:opacity-50"
      >
        {saving ? "جاري الحفظ..." : "حفظ السند"}
      </button>
    </div>
  );
}
