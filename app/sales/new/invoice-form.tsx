"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createInvoice } from "@/lib/actions/sales";

type Product = {
  id: string;
  name: string;
  sku: string | null;
  price: number;
  stocks: Record<string, number>;
};
type Branch = { id: string; name: string; warehouses: { id: string; name: string }[] };
type Customer = { id: string; name: string };
type CurrencyInfo = { code: string; decimals: number; rate: number | null };
type Line = { productId: string; name: string; quantity: number; unitPrice: number };

export default function InvoiceForm(props: {
  branches: Branch[];
  customers: Customer[];
  products: Product[];
  currencies: CurrencyInfo[];
  baseCurrency: string;
}) {
  const { branches, customers, products, currencies, baseCurrency } = props;
  const router = useRouter();

  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const [warehouseId, setWarehouseId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [currency, setCurrency] = useState(baseCurrency);
  const [search, setSearch] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [discountType, setDiscountType] = useState<"NONE" | "PERCENT" | "FIXED">("NONE");
  const [discountValue, setDiscountValue] = useState("");
  const [cash, setCash] = useState("");
  const [knet, setKnet] = useState("");
  const [card, setCard] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const warehouses = branches.find((b) => b.id === branchId)?.warehouses ?? [];
  const activeWarehouseId = warehouses.some((w) => w.id === warehouseId)
    ? warehouseId
    : warehouses[0]?.id ?? "";

  const cur = currencies.find((c) => c.code === currency);
  const dec = cur?.decimals ?? 3;
  const rate = cur?.rate ?? null;
  const fmt = (n: number) => n.toFixed(dec);

  const subtotal = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  const dv = Number(discountValue) || 0;
  const discount =
    discountType === "PERCENT"
      ? (subtotal * Math.min(dv, 100)) / 100
      : discountType === "FIXED"
      ? Math.min(dv, subtotal)
      : 0;
  const total = subtotal - discount;
  const paid = (Number(cash) || 0) + (Number(knet) || 0) + (Number(card) || 0);
  const balance = total - paid;

  const q = search.trim().toLowerCase();
  const results = q
    ? products
        .filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            (p.sku ?? "").toLowerCase().includes(q)
        )
        .slice(0, 8)
    : [];

  function addProduct(p: Product) {
    setLines((prev) => {
      const existing = prev.find((l) => l.productId === p.id);
      if (existing) {
        return prev.map((l) =>
          l.productId === p.id ? { ...l, quantity: l.quantity + 1 } : l
        );
      }
      const price = rate ? p.price / rate : p.price;
      return [
        ...prev,
        {
          productId: p.id,
          name: p.name,
          quantity: 1,
          unitPrice: Number(price.toFixed(dec)),
        },
      ];
    });
    setSearch("");
  }

  function updateLine(id: string, patch: Partial<Line>) {
    setLines((prev) => prev.map((l) => (l.productId === id ? { ...l, ...patch } : l)));
  }

  async function submit() {
    setError("");
    setSaving(true);
    const payments = [
      { method: "CASH", amount: Number(cash) || 0 },
      { method: "KNET", amount: Number(knet) || 0 },
      { method: "CARD", amount: Number(card) || 0 },
    ].filter((p) => p.amount > 0);

    const res = await createInvoice({
      branchId,
      warehouseId: activeWarehouseId,
      customerId: customerId || null,
      currency,
      discountType,
      discountValue: dv,
      items: lines.map((l) => ({
        productId: l.productId,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
      })),
      payments,
    });
    setSaving(false);
    if (res.ok) router.push("/sales");
    else setError(res.error);
  }

  const field = "w-full rounded-lg border px-3 py-2";
  const canSubmit = lines.length > 0 && rate !== null && !saving;

  return (
    <div dir="rtl" className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <select className={field} value={branchId} onChange={(e) => setBranchId(e.target.value)}>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        <select className={field} value={activeWarehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
        <select className={field} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
          <option value="">بدون عميل (نقدي)</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          className={field}
          value={currency}
          onChange={(e) => {
            setCurrency(e.target.value);
            setLines([]);
          }}
        >
          {currencies.map((c) => (
            <option key={c.code} value={c.code}>{c.code}</option>
          ))}
        </select>
      </div>
      {rate === null && (
        <p className="text-sm text-red-600">لا يوجد سعر صرف لهذه العملة، أضفه أولاً.</p>
      )}

      <div>
        <input
          className={field}
          placeholder="ابحث بالاسم أو الكود..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {results.length > 0 && (
          <div className="mt-1 divide-y rounded-lg border bg-white">
            {results.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => addProduct(p)}
                className="flex w-full items-center justify-between px-3 py-2 text-start"
              >
                <span>
                  {p.name} {p.sku ? `(${p.sku})` : ""}
                </span>
                <span className="text-sm text-gray-500">
                  المتاح: {p.stocks[activeWarehouseId] ?? 0}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        {lines.map((l) => (
          <div key={l.productId} className="rounded-lg border p-3">
            <div className="mb-2 flex justify-between">
              <span className="font-medium">{l.name}</span>
              <button
                type="button"
                className="text-red-600"
                onClick={() => setLines((prev) => prev.filter((x) => x.productId !== l.productId))}
              >
                حذف
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <input
                type="number"
                min={1}
                className={field}
                value={l.quantity}
                onChange={(e) =>
                  updateLine(l.productId, { quantity: Math.max(1, Math.floor(Number(e.target.value) || 1)) })
                }
              />
              <input
                type="number"
                step="any"
                className={field}
                value={l.unitPrice}
                onChange={(e) => updateLine(l.productId, { unitPrice: Number(e.target.value) || 0 })}
              />
              <div className="flex items-center justify-end">
                {fmt(l.quantity * l.unitPrice)}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <select className={field} value={discountType} onChange={(e) => setDiscountType(e.target.value as "NONE" | "PERCENT" | "FIXED")}>
          <option value="NONE">بدون خصم</option>
          <option value="PERCENT">خصم %</option>
          <option value="FIXED">خصم مبلغ</option>
        </select>
        <input
          type="number"
          step="any"
          className={field}
          placeholder="قيمة الخصم"
          value={discountValue}
          onChange={(e) => setDiscountValue(e.target.value)}
        />
      </div>

      <div className="rounded-lg border p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="font-medium">الدفع</span>
          <button
            type="button"
            className="text-sm text-purple-600"
            onClick={() => {
              setCash(fmt(total));
              setKnet("");
              setCard("");
            }}
          >
            كاش بالكامل
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <input type="number" step="any" className={field} placeholder="كاش" value={cash} onChange={(e) => setCash(e.target.value)} />
          <input type="number" step="any" className={field} placeholder="كي نت" value={knet} onChange={(e) => setKnet(e.target.value)} />
          <input type="number" step="any" className={field} placeholder="فيزا" value={card} onChange={(e) => setCard(e.target.value)} />
        </div>
      </div>

      <div className="space-y-1 rounded-lg bg-gray-50 p-3">
        <div className="flex justify-between"><span>المجموع</span><span>{fmt(subtotal)}</span></div>
        <div className="flex justify-between"><span>الخصم</span><span>{fmt(discount)}</span></div>
        <div className="flex justify-between text-lg font-bold">
          <span>الإجمالي ({currency})</span><span>{fmt(total)}</span>
        </div>
        <div className="flex justify-between"><span>المدفوع</span><span>{fmt(paid)}</span></div>
        <div className="flex justify-between">
          <span>{balance > 0 ? "الآجل" : "المتبقي"}</span>
          <span>{fmt(Math.max(balance, 0))}</span>
        </div>
      </div>

      {error && <p className="text-red-600">{error}</p>}

      <button
        type="button"
        disabled={!canSubmit}
        onClick={submit}
        className="w-full rounded-lg bg-purple-600 py-3 font-semibold text-white disabled:opacity-50"
      >
        {saving ? "جاري الحفظ..." : "حفظ الفاتورة"}
      </button>
    </div>
  );
}
