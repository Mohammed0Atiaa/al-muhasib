"use client";

import { useState, useEffect } from "react";
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
type Customer = { id: string; name: string; phone?: string | null };
type CurrencyInfo = { code: string; decimals: number; rate: number | null };
type Line = { productId: string; name: string; quantity: number; unitPrice: number };

export default function InvoiceForm(props: {
  branches: Branch[];
  customers: Customer[];
  products: Product[];
  currencies: CurrencyInfo[];
  baseCurrency: string;
}) {
  const { branches, customers: initialCustomers, products, currencies, baseCurrency } = props;
  const router = useRouter();

  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const [warehouseId, setWarehouseId] = useState("");
  
  // حالة العميل الذكية
  const [phone, setPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);

  // حقل البيان / الملاحظات
  const [notes, setNotes] = useState("");

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

  // البحث التلقائي للعميل عند إدخال رقم الهاتف
  useEffect(() => {
    const searchCustomerByPhone = async () => {
      if (!phone || phone.trim().length < 3) {
        setCustomerId("");
        setIsNewCustomer(false);
        return;
      }

      setIsSearchingCustomer(true);
      try {
        const res = await fetch(`/api/customers?phone=${encodeURIComponent(phone.trim())}`);
        const data = await res.json();

        if (data.customer) {
          setCustomerId(data.customer.id);
          setCustomerName(data.customer.name);
          setIsNewCustomer(false);
        } else {
          setCustomerId("");
          setIsNewCustomer(true);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsSearchingCustomer(false);
      }
    };

    const timer = setTimeout(searchCustomerByPhone, 400);
    return () => clearTimeout(timer);
  }, [phone]);

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

    let activeCustomerId = customerId;

    // إذا كان العميل جديداً وتم كتابة اسمه ورقم هاتفه، نقوم بحفظه تلقائياً أولاً
    if (isNewCustomer && customerName.trim() && phone.trim()) {
      try {
        const createRes = await fetch("/api/customers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: customerName.trim(), phone: phone.trim() }),
        });
        const data = await createRes.json();
        if (data.customer) {
          activeCustomerId = data.customer.id;
        }
      } catch (err) {
        console.error("Failed to auto-save customer:", err);
      }
    }

    const payments = [
      { method: "CASH", amount: Number(cash) || 0 },
      { method: "KNET", amount: Number(knet) || 0 },
      { method: "CARD", amount: Number(card) || 0 },
    ].filter((p) => p.amount > 0);

    const res = await createInvoice({
      branchId,
      warehouseId: activeWarehouseId,
      customerId: activeCustomerId || null,
      currency,
      discountType,
      discountValue: dv,
      notes: notes.trim() || undefined,
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

  const field = "w-full rounded-lg border px-3 py-2 text-sm";
  const canSubmit = lines.length > 0 && rate !== null && !saving;

  return (
    <div dir="rtl" className="space-y-4">
      {/* الفرع، المخزن والعملة */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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

      {/* قسم العميل الذكي (رقم الهاتف والاسم) */}
      <div className="p-4 rounded-xl border bg-white space-y-3">
        <h3 className="text-xs font-bold text-gray-500 uppercase">بيانات العميل والتركيب</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">رقم الهاتف (للبحث أو التسجيل)</label>
            <input
              type="text"
              className={field}
              placeholder="ابحث برقم الهاتف..."
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">اسم العميل</label>
            <input
              type="text"
              className={field}
              placeholder="اسم العميل (نقدي إذا فارغ)..."
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
          </div>
        </div>

        {/* تنبيهات حالة العميل */}
        {isSearchingCustomer && <p className="text-xs text-gray-400">جاري التحقق من رقم الهاتف...</p>}
        {customerId && !isSearchingCustomer && (
          <p className="text-xs text-green-600 font-medium">✓ عميل مسجل مسبقاً، سيتم ربط الفاتورة به.</p>
        )}
        {isNewCustomer && phone.length >= 3 && (
          <p className="text-xs text-amber-600 font-medium">⭐ رقم جديد: سيتم حفظه تلقائياً عند حفظ الفاتورة.</p>
        )}

        {/* حقل البيان / الملاحظات */}
        <div>
          <label className="block text-xs text-gray-600 mb-1">البيان / ملاحظات (العنوان، موعد التسليم، التركيب)</label>
          <textarea
            rows={2}
            className={field}
            placeholder="اكتب تفاصيل العنوان أو التركيب أو التسليم..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </div>

      {rate === null && (
        <p className="text-sm text-red-600">لا يوجد سعر صرف لهذه العملة، أضفه أولاً.</p>
      )}

      {/* البحث عن المنتجات */}
      <div>
        <input
          className={field}
          placeholder="ابحث عن المنتج بالاسم أو الكود..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {results.length > 0 && (
          <div className="mt-1 divide-y rounded-lg border bg-white shadow-sm">
            {results.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => addProduct(p)}
                className="flex w-full items-center justify-between px-3 py-2 text-start hover:bg-gray-50"
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

      {/* جدول المنتجات المختارة */}
      <div className="space-y-2">
        {lines.map((l) => (
          <div key={l.productId} className="rounded-lg border p-3 bg-white">
            <div className="mb-2 flex justify-between items-center">
              <span className="font-medium text-sm">{l.name}</span>
              <button
                type="button"
                className="text-red-600 text-xs font-semibold"
                onClick={() => setLines((prev) => prev.filter((x) => x.productId !== l.productId))}
              >
                حذف
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] text-gray-400 mb-0.5">الكمية</label>
                <input
                  type="number"
                  min={1}
                  className={field}
                  value={l.quantity}
                  onChange={(e) =>
                    updateLine(l.productId, { quantity: Math.max(1, Math.floor(Number(e.target.value) || 1)) })
                  }
                />
              </div>
              <div>
                <label className="block text-[10px] text-gray-400 mb-0.5">سعر الوحدة</label>
                <input
                  type="number"
                  step="any"
                  className={field}
                  value={l.unitPrice}
                  onChange={(e) => updateLine(l.productId, { unitPrice: Number(e.target.value) || 0 })}
                />
              </div>
              <div className="flex flex-col justify-end items-end pb-2">
                <span className="text-[10px] text-gray-400">الإجمالي</span>
                <span className="font-bold text-sm">{fmt(l.quantity * l.unitPrice)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* الخصم */}
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

      {/* قسم الدفع */}
      <div className="rounded-lg border p-3 bg-white">
        <div className="mb-2 flex items-center justify-between">
          <span className="font-medium text-sm">الدفع</span>
          <button
            type="button"
            className="text-xs text-purple-600 font-semibold"
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
          <div>
            <label className="block text-[10px] text-gray-400 mb-0.5">كاش</label>
            <input type="number" step="any" className={field} placeholder="0.000" value={cash} onChange={(e) => setCash(e.target.value)} />
          </div>
          <div>
            <label className="block text-[10px] text-gray-400 mb-0.5">كي نت</label>
            <input type="number" step="any" className={field} placeholder="0.000" value={knet} onChange={(e) => setKnet(e.target.value)} />
          </div>
          <div>
            <label className="block text-[10px] text-gray-400 mb-0.5">فيزا</label>
            <input type="number" step="any" className={field} placeholder="0.000" value={card} onChange={(e) => setCard(e.target.value)} />
          </div>
        </div>
      </div>

      {/* ملخص المبالغ */}
      <div className="space-y-1 rounded-lg bg-gray-100 p-3 text-sm">
        <div className="flex justify-between"><span>المجموع</span><span>{fmt(subtotal)}</span></div>
        <div className="flex justify-between"><span>الخصم</span><span>{fmt(discount)}</span></div>
        <div className="flex justify-between text-base font-bold border-t pt-1">
          <span>الإجمالي ({currency})</span><span>{fmt(total)}</span>
        </div>
        <div className="flex justify-between"><span>المدفوع</span><span>{fmt(paid)}</span></div>
        <div className="flex justify-between font-semibold text-purple-700">
          <span>{balance > 0 ? "الآجل (المتبقي)" : "المتبقي"}</span>
          <span>{fmt(Math.max(balance, 0))}</span>
        </div>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <button
        type="button"
        disabled={!canSubmit}
        onClick={submit}
        className="w-full rounded-lg bg-purple-600 py-3 font-semibold text-white disabled:opacity-50 hover:bg-purple-700 transition"
      >
        {saving ? "جاري الحفظ وإصدار الفاتورة..." : "حفظ الفاتورة"}
      </button>
    </div>
  );
}
