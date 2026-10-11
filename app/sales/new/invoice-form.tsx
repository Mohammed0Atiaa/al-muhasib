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

type Line = {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  searchQuery: string;
  showDropdown: boolean;
};

export default function InvoiceForm(props: {
  branches: Branch[];
  customers: Customer[];
  products: Product[];
  currencies: CurrencyInfo[];
  baseCurrency: string;
}) {
  const { branches, products, baseCurrency } = props;
  const router = useRouter();

  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const [warehouseId, setWarehouseId] = useState("");
  
  // حالة العميل والدفع
  const [phone, setPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);

  // الملاحظات والبيان
  const [notes, setNotes] = useState("");

  // العملة مثبتة تلقائياً من نظام الشركة بدون إتاحة التعديل
  const currency = baseCurrency;

  // 🟢 5 أسطر مبيعات افتراضية في جدول المنتجات
  const [lines, setLines] = useState<Line[]>([
    { productId: "", name: "", quantity: 1, unitPrice: 0, searchQuery: "", showDropdown: false },
    { productId: "", name: "", quantity: 1, unitPrice: 0, searchQuery: "", showDropdown: false },
    { productId: "", name: "", quantity: 1, unitPrice: 0, searchQuery: "", showDropdown: false },
    { productId: "", name: "", quantity: 1, unitPrice: 0, searchQuery: "", showDropdown: false },
    { productId: "", name: "", quantity: 1, unitPrice: 0, searchQuery: "", showDropdown: false },
  ]);

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

  const dec = currency === "EGP" ? 2 : 3;
  const fmt = (n: number) => n.toFixed(dec);

  const subtotal = lines.reduce((s, l) => s + (l.productId ? l.quantity * l.unitPrice : 0), 0);
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

  const currencyLabel = currency === "EGP" ? "جنيه مصري" : currency === "KWD" ? "دينار كويتي" : currency;

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

  function updateLine(index: number, patch: Partial<Line>) {
    setLines((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], ...patch };
      
      if (index === updated.length - 1 && patch.productId && patch.productId !== "") {
        updated.push({
          productId: "",
          name: "",
          quantity: 1,
          unitPrice: 0,
          searchQuery: "",
          showDropdown: false,
        });
      }
      return updated;
    });
  }

  function selectProductForLine(index: number, p: Product) {
    setLines((prev) => {
      const updated = [...prev];
      updated[index] = {
        productId: p.id,
        name: p.name,
        quantity: updated[index].quantity || 1,
        unitPrice: Number(p.price),
        searchQuery: p.name,
        showDropdown: false,
      };

      if (index === updated.length - 1) {
        updated.push({
          productId: "",
          name: "",
          quantity: 1,
          unitPrice: 0,
          searchQuery: "",
          showDropdown: false,
        });
      }
      return updated;
    });
  }

  function addRow() {
    setLines((prev) => [
      ...prev,
      { productId: "", name: "", quantity: 1, unitPrice: 0, searchQuery: "", showDropdown: false },
    ]);
  }

  function removeRow(index: number) {
    if (lines.length === 1) return;
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  async function submit() {
    if (!customerName.trim() || !phone.trim()) {
      setError("اسم العميل ورقم الهاتف إجباريان عند إتمام الدفع.");
      return;
    }

    const validItems = lines.filter((l) => l.productId && l.quantity > 0);
    if (validItems.length === 0) {
      setError("يرجى اختيار منتج واحد على الأقل للبيع.");
      return;
    }

    setError("");
    setSaving(true);

    let activeCustomerId = customerId;

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
      items: validItems.map((l) => ({
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

  const field = "w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 outline-none";
  const validItemsCount = lines.filter((l) => l.productId && l.quantity > 0).length;

  return (
    <div dir="rtl" className="space-y-4">
      {/* اختيار الفرع والمستودع */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white p-4 rounded-xl border shadow-sm">
        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">الفرع</label>
          <select className={field} value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">المستودع (المخزن)</label>
          <select className={field} value={activeWarehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 🟢 جدول أسطر المبيعات الديناميكي (Multi-Line POS Table) */}
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden p-4 space-y-3">
        <div className="flex items-center justify-between border-b pb-2">
          <h3 className="font-bold text-gray-800 text-sm">جدول الأصناف والمنتجات</h3>
          <span className="text-xs font-semibold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-full">
            العملة: {currencyLabel}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-gray-50 border-b text-gray-600">
              <tr>
                <th className="p-3 w-12 text-center">#</th>
                <th className="p-3">بحث واختيار المنتج</th>
                <th className="p-3 w-32">السعر ({currency})</th>
                <th className="p-3 w-28">الكمية</th>
                <th className="p-3 w-32">الإجمالي</th>
                <th className="p-3 w-16 text-center">حذف</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {lines.map((l, idx) => {
                const sq = l.searchQuery.trim().toLowerCase();
                const matchedProducts = sq
                  ? products
                      .filter(
                        (p) =>
                          p.name.toLowerCase().includes(sq) ||
                          (p.sku ?? "").toLowerCase().includes(sq)
                      )
                      .slice(0, 6)
                  : [];

                return (
                  <tr key={idx} className="hover:bg-gray-50/50 relative">
                    <td className="p-3 text-center text-gray-400 font-mono text-xs">{idx + 1}</td>
                    
                    <td className="p-3 relative">
                      <input
                        type="text"
                        className={field}
                        placeholder="ابحث بالاسم أو الباركود..."
                        value={l.searchQuery}
                        onChange={(e) => {
                          updateLine(idx, { searchQuery: e.target.value, showDropdown: true });
                        }}
                        onFocus={() => updateLine(idx, { showDropdown: true })}
                      />
                      {l.showDropdown && matchedProducts.length > 0 && (
                        <div className="absolute z-30 left-0 right-0 mt-1 bg-white border rounded-lg shadow-xl max-h-48 overflow-y-auto divide-y">
                          {matchedProducts.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => selectProductForLine(idx, p)}
                              className="w-full text-start px-3.5 py-2 text-xs flex justify-between items-center hover:bg-purple-50 transition"
                            >
                              <span className="font-semibold text-gray-800">
                                {p.name} {p.sku ? `(${p.sku})` : ""}
                              </span>
                              <span className="text-purple-600 bg-purple-100/50 px-2 py-0.5 rounded">
                                متاح: {p.stocks[activeWarehouseId] ?? 0} | السعر: {Number(p.price).toFixed(dec)}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </td>

                    <td className="p-3 font-semibold text-gray-700 font-mono">
                      {l.productId ? fmt(l.unitPrice) : "-"}
                    </td>

                    <td className="p-3">
                      <input
                        type="number"
                        min={1}
                        disabled={!l.productId}
                        className="w-full border rounded-lg p-1.5 text-center text-sm font-bold focus:ring-2 focus:ring-purple-500 outline-none disabled:bg-gray-100"
                        value={l.quantity}
                        onChange={(e) =>
                          updateLine(idx, { quantity: Math.max(1, Math.floor(Number(e.target.value) || 1)) })
                        }
                      />
                    </td>

                    <td className="p-3 font-bold text-purple-700 font-mono">
                      {l.productId ? fmt(l.quantity * l.unitPrice) : fmt(0)}
                    </td>

                    <td className="p-3 text-center">
                      <button
                        type="button"
                        className="text-red-500 hover:text-red-700 text-xs font-bold px-2 py-1 rounded bg-red-50 transition"
                        onClick={() => removeRow(idx)}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex justify-between items-center pt-2">
          <button
            type="button"
            onClick={addRow}
            className="px-4 py-2 border border-purple-300 text-purple-700 rounded-lg text-xs font-bold hover:bg-purple-50 transition"
          >
            + إضافة سطر يدوياً
          </button>
          <span className="text-xs text-gray-500">البنود المضافة: {validItemsCount}</span>
        </div>
      </div>

      {/* الخصم والدفع */}
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

      {/* طرق التحصيل */}
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
            <label className="block text-xs text-gray-600 mb-1">شبكة (كي نت / فيزا)</label>
            <input type="number" step="any" className={field} placeholder="0.000" value={knet} onChange={(e) => setKnet(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">بطاقة ائتمانية</label>
            <input type="number" step="any" className={field} placeholder="0.000" value={card} onChange={(e) => setCard(e.target.value)} />
          </div>
        </div>
      </div>

      {/* ملخص المبالغ المالية */}
      <div className="space-y-1.5 rounded-xl bg-gray-50 p-4 border text-sm shadow-sm">
        <div className="flex justify-between text-gray-600"><span>المجموع الفرعي</span><span>{fmt(subtotal)} {currencyLabel}</span></div>
        <div className="flex justify-between text-gray-600"><span>قيمة الخصم</span><span>{fmt(discount)} {currencyLabel}</span></div>
        <div className="flex justify-between text-base font-bold text-gray-900 border-t pt-2">
          <span>الإجمالي النهائي</span><span>{fmt(total)} {currencyLabel}</span>
        </div>
      </div>

      {error && <p className="text-red-600 text-sm font-semibold p-3 bg-red-50 rounded-lg">{error}</p>}

      {/* زر إتمام الفاتورة */}
      <button
        type="button"
        disabled={validItemsCount === 0}
        onClick={() => setShowCheckoutModal(true)}
        className="w-full rounded-xl bg-green-600 py-3.5 font-bold text-white disabled:opacity-50 hover:bg-green-700 transition text-lg shadow-md"
      >
        إتمام الدفع وتسجيل العميل 💳 ({fmt(total)} {currencyLabel})
      </button>

      {/* النافذة المنبثقة للعميل والبيان */}
      {showCheckoutModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4" dir="rtl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-lg font-bold text-gray-900">بيانات العميل والتركيب (إجباري)</h3>
              <button
                onClick={() => setShowCheckoutModal(false)}
                className="text-gray-400 hover:text-gray-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                رقم الهاتف <span className="text-red-500">* (ابحث برقم الهاتف)</span>
              </label>
              <input
                type="text"
                dir="ltr"
                placeholder="رقم الهاتف..."
                className={field}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              {isSearchingCustomer && <p className="text-xs text-purple-600 mt-1">جاري البحث عن العميل...</p>}
              {customerId && !isSearchingCustomer && (
                <p className="text-xs text-green-600 font-medium mt-1">✓ عميل مسجل مسبقاً، تم جلب البيانات.</p>
              )}
              {isNewCustomer && phone.length >= 3 && (
                <p className="text-xs text-amber-600 font-medium mt-1">⭐ رقم جديد: سيتم حفظه تلقائياً كعميل جديد.</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                اسم العميل <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="اسم العميل الرباعي"
                className={field}
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">البيان / الملاحظات (العنوان، التركيب، التسليم)</label>
              <textarea
                rows={3}
                className={field}
                placeholder="اكتب البيان أو تفاصيل العنوان أو التركيب والتسليم..."
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
                {saving ? "جاري الحفظ والطباعة..." : `حفظ وتأكيد (${fmt(total)} ${currencyLabel})`}
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
