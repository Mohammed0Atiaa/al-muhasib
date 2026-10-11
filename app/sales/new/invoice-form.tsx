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
  const { branches, products, currencies, baseCurrency } = props;
  const router = useRouter();

  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const [warehouseId, setWarehouseId] = useState("");
  
  // حالة العميل في نافذة الدفع
  const [phone, setPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);

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
    if (!customerName.trim() || !phone.trim()) {
      setError("اسم العميل ورقم الهاتف إجباريان عند إتمام الدفع.");
      return;
    }

    setError("");
    setSaving(true);

    let activeCustomerId = customerId;

    // حفظ العميل الجديد تلقائياً إن لم يكن موجوداً
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
    if (res.ok) router.push(`/sales/${res.id}?done=created`);
    else {
      setError(res.error);
      setShowCheckoutModal(false);
    }
  }

  const field = "w-full rounded-lg border px-3 py-2 text-sm";
  const canProceedToCheckout = lines.length > 0 && rate !== null;

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

      {rate === null && (
        <p className="text-sm text-red-600">لا يوجد سعر صرف لهذه العملة، أضفه أولاً.</p>
      )}

      {/* البحث عن المنتجات */}
      <div className="relative">
        <label className="block text-xs font-bold text-gray-700 mb-1">بحث واختيار المنتجات</label>
        <input
          className={field}
          placeholder="ابحث عن المنتج بالاسم أو الكود (SKU)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {results.length > 0 && (
          <div className="absolute z-20 left-0 right-0 mt-1 divide-y rounded-lg border bg-white shadow-lg">
            {results.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => addProduct(p)}
                className="flex w-full items-center justify-between px-3.5 py-2.5 text-start hover:bg-purple-50 transition"
              >
                <span className="font-semibold text-gray-800">
                  {p.name} {p.sku ? `(${p.sku})` : ""}
                </span>
                <span className="text-xs font-medium text-purple-600 bg-purple-50 px-2 py-1 rounded">
                  المتاح بالمخزن: {p.stocks[activeWarehouseId] ?? 0}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* جدول المنتجات المختارة (POS Style) */}
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <table className="w-full text-sm text-right">
          <thead className="bg-gray-50 border-b text-gray-600">
            <tr>
              <th className="p-3">المنتج</th>
              <th className="p-3 w-32">سعر الوحدة (ثابت)</th>
              <th className="p-3 w-28">الكمية</th>
              <th className="p-3 w-32">الإجمالي</th>
              <th className="p-3 w-16 text-center">حذف</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {lines.map((l) => (
              <tr key={l.productId} className="hover:bg-gray-50/50">
                <td className="p-3 font-semibold text-gray-900">{l.name}</td>
                <td className="p-3 text-gray-600 font-mono">{fmt(l.unitPrice)}</td>
                <td className="p-3">
                  <input
                    type="number"
                    min={1}
                    className="w-full border rounded-lg p-1.5 text-center text-sm font-bold focus:ring-2 focus:ring-purple-500 outline-none"
                    value={l.quantity}
                    onChange={(e) =>
                      updateLine(l.productId, { quantity: Math.max(1, Math.floor(Number(e.target.value) || 1)) })
                    }
                  />
                </td>
                <td className="p-3 font-bold text-purple-700 font-mono">{fmt(l.quantity * l.unitPrice)}</td>
                <td className="p-3 text-center">
                  <button
                    type="button"
                    className="text-red-500 hover:text-red-700 text-xs font-bold px-2 py-1 rounded bg-red-50"
                    onClick={() => setLines((prev) => prev.filter((x) => x.productId !== l.productId))}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
            {lines.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-gray-400">
                  لم يتم إضافة منتجات للفاتورة بعد. ابحث واختر المنتجات أعلاه.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* الخصم */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white p-4 rounded-xl border shadow-sm">
        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">نوع الخصم</label>
          <select className={field} value={discountType} onChange={(e) => setDiscountType(e.target.value as "NONE" | "PERCENT" | "FIXED")}>
            <option value="NONE">بدون خصم</option>
            <option value="PERCENT">خصم نسبة مئوية %</option>
            <option value="FIXED">خصم مبلغ ثابت</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">قيمة الخصم</label>
          <input
            type="number"
            step="any"
            className={field}
            placeholder="قيمة الخصم"
            value={discountValue}
            onChange={(e) => setDiscountValue(e.target.value)}
          />
        </div>
      </div>

      {/* قسم الدفع */}
      <div className="rounded-xl border p-4 bg-white shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-bold text-sm text-gray-800">طرق الدفع والتحصيل</span>
          <button
            type="button"
            className="text-xs text-purple-700 bg-purple-50 px-3 py-1 rounded-md font-semibold hover:bg-purple-100"
            onClick={() => {
              setCash(fmt(total));
              setKnet("");
              setCard("");
            }}
          >
            تغطية المبلغ بالكامل (كاش)
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">كاش (نقدي)</label>
            <input type="number" step="any" className={field} placeholder="0.000" value={cash} onChange={(e) => setCash(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">شبكة (كي نت)</label>
            <input type="number" step="any" className={field} placeholder="0.000" value={knet} onChange={(e) => setKnet(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">بطاقة ائتمانية (فيزا)</label>
            <input type="number" step="any" className={field} placeholder="0.000" value={card} onChange={(e) => setCard(e.target.value)} />
          </div>
        </div>
      </div>

      {/* ملخص المبالغ المالية */}
      <div className="space-y-1.5 rounded-xl bg-gray-50 p-4 border text-sm shadow-sm">
        <div className="flex justify-between text-gray-600"><span>المجموع الفرعي</span><span>{fmt(subtotal)}</span></div>
        <div className="flex justify-between text-gray-600"><span>قيمة الخصم</span><span>{fmt(discount)}</span></div>
        <div className="flex justify-between text-base font-bold text-gray-900 border-t pt-2">
          <span>الإجمالي النهائي ({currency})</span><span>{fmt(total)}</span>
        </div>
        <div className="flex justify-between text-gray-600"><span>إجمالي المدفوع</span><span>{fmt(paid)}</span></div>
        <div className="flex justify-between font-bold text-purple-700 text-base">
          <span>{balance > 0 ? "المبلغ الآجل (المتبقي)" : "المتبقي للعميل"}</span>
          <span>{fmt(Math.max(balance, 0))}</span>
        </div>
      </div>

      {error && <p className="text-red-600 text-sm font-semibold p-3 bg-red-50 rounded-lg">{error}</p>}

      {/* زر الانتقال لنافذة إدخال بيانات العميل والدفع */}
      <button
        type="button"
        disabled={!canProceedToCheckout}
        onClick={() => setShowCheckoutModal(true)}
        className="w-full rounded-xl bg-green-600 py-3.5 font-bold text-white disabled:opacity-50 hover:bg-green-700 transition text-lg shadow-md"
      >
        إتمام الدفع وتسجيل العميل 💳 ({fmt(total)} {currency})
      </button>

      {/* نافذة إدخال بيانات العميل عند تقفيل الفاتورة (Checkout Modal) */}
      {showCheckoutModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4" dir="rtl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-lg font-bold text-gray-900">بيانات العميل (إجباري)</h3>
              <button
                onClick={() => setShowCheckoutModal(false)}
                className="text-gray-400 hover:text-gray-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                رقم الهاتف <span className="text-red-500">* (ابحث بالرقم)</span>
              </label>
              <input
                type="text"
                dir="ltr"
                placeholder="+965 ..."
                className={field}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              {isSearchingCustomer && <p className="text-xs text-purple-600 mt-1">جاري التحقق من رقم الهاتف...</p>}
              {customerId && !isSearchingCustomer && (
                <p className="text-xs text-green-600 font-medium mt-1">✓ عميل مسجل مسبقاً، تم جلب بياناته.</p>
              )}
              {isNewCustomer && phone.length >= 3 && (
                <p className="text-xs text-amber-600 font-medium mt-1">⭐ رقم جديد: سيتم حفظه كعميل جديد تلقائياً.</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                اسم العميل <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="اسم العميل الثلاثي أو الرباعي"
                className={field}
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">البيان / ملاحظات (العنوان، التركيب، التسليم)</label>
              <textarea
                rows={3}
                className={field}
                placeholder="اكتب تفاصيل العنوان أو التركيب أو التسليم..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div className="pt-2 flex gap-3">
              <button
                type="button"
                disabled={saving}
                onClick={submit}
                className="flex-1 py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 disabled:opacity-50 transition"
              >
                {saving ? "جاري الحفظ وإصدار الفاتورة..." : `تأكيد ودفع (${fmt(total)} ${currency})`}
              </button>
              <button
                type="button"
                onClick={() => setShowCheckoutModal(false)}
                className="px-4 py-3 border rounded-xl text-gray-600 hover:bg-gray-50 text-sm font-medium"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
