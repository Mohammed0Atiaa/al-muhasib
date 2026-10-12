"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

type Line = { productId: string; searchQuery: string; qty: string };

const MIN_ROWS = 5;
const makeLine = (): Line => ({ productId: "", searchQuery: "", qty: "1" });

const CURRENCY_LABELS: Record<string, string> = {
  KWD: "دينار كويتي",
  EGP: "جنيه مصري",
  SAR: "ريال سعودي",
  AED: "درهم إماراتي",
  USD: "دولار أمريكي",
};

// دايماً 5 أسطر على الأقل، وسطر جديد يظهر لما كل الأسطر تتملي
function normalize(ls: Line[]): Line[] {
  const out = [...ls];
  while (out.length < MIN_ROWS) out.push(makeLine());
  if (out.every((l) => l.productId)) out.push(makeLine());
  return out;
}

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

  // العميل
  const [phone, setPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [notes, setNotes] = useState("");

  const currency = baseCurrency;
  const dec = currencies.find((c) => c.code === currency)?.decimals ?? 3;
  const fmt = (n: number) => n.toFixed(dec);
  const currencyLabel = CURRENCY_LABELS[currency] ?? currency;

  const [lines, setLines] = useState<Line[]>(() => normalize([]));
  const [openRow, setOpenRow] = useState<number | null>(null);
  const searchRefs = useRef<(HTMLInputElement | null)[]>([]);
  const qtyRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [discountType, setDiscountType] = useState<"NONE" | "PERCENT" | "FIXED">("NONE");
  const [discountValue, setDiscountValue] = useState("");
  const [cash, setCash] = useState("");
  const [knet, setKnet] = useState("");
  const [card, setCard] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const warehouses = branches.find((b) => b.id === branchId)?.warehouses ?? [];
  const activeWarehouseId = warehouses.some((w) => w.id === warehouseId)
    ? warehouseId
    : warehouses[0]?.id ?? "";
  const stockOf = (p: Product) => p.stocks[activeWarehouseId] ?? 0;

  const qtyNum = (l: Line) => Math.max(0, Math.floor(Number(l.qty) || 0));
  const validLines = lines.filter((l) => l.productId && qtyNum(l) >= 1);
  const overStock = validLines.filter((l) => {
    const p = byId.get(l.productId);
    return p ? qtyNum(l) > stockOf(p) : false;
  });

  const subtotal = validLines.reduce(
    (s, l) => s + qtyNum(l) * (byId.get(l.productId)?.price ?? 0),
    0
  );
  const dv = Number(discountValue) || 0;
  const discount =
    discountType === "PERCENT"
      ? (subtotal * Math.min(dv, 100)) / 100
      : discountType === "FIXED"
      ? Math.min(dv, subtotal)
      : 0;
  const total = subtotal - discount;

  // إغلاق قوائم البحث عند الضغط بره
  useEffect(() => {
    function onDown(e: Event) {
      const t = e.target as HTMLElement | null;
      if (!t?.closest("[data-search-cell]")) setOpenRow(null);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, []);

  // البحث عن العميل برقم الهاتف
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

  function findMatches(q: string) {
    const s = q.toLowerCase();
    return products
      .filter((p) => p.name.toLowerCase().includes(s) || (p.sku ?? "").toLowerCase().includes(s))
      .slice(0, 6);
  }

  // الكتابة في البحث بتفرّغ المنتج المثبّت لحد ما تختار من القائمة
  function setQuery(idx: number, q: string) {
    setLines((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, searchQuery: q, productId: "" } : l))
    );
    setOpenRow(idx);
  }

  function pick(idx: number, p: Product) {
    const isDup = lines.some((l, i) => i !== idx && l.productId === p.id);
    setLines((prev) => {
      const dupIdx = prev.findIndex((l, i) => i !== idx && l.productId === p.id);
      if (dupIdx >= 0) {
        // نفس المنتج مختار قبل كده: نزوّد كميته بدل سطر مكرر
        const add = Math.max(1, Math.floor(Number(prev[idx].qty) || 1));
        return normalize(
          prev.map((l, i) => {
            if (i === dupIdx) return { ...l, qty: String(qtyNum(l) + add) };
            if (i === idx) return makeLine();
            return l;
          })
        );
      }
      return normalize(
        prev.map((l, i) =>
          i === idx
            ? {
                productId: p.id,
                searchQuery: p.name,
                qty: l.qty && Number(l.qty) >= 1 ? l.qty : "1",
              }
            : l
        )
      );
    });
    setOpenRow(null);
    setTimeout(() => {
      if (isDup) searchRefs.current[idx]?.focus();
      else qtyRefs.current[idx]?.focus();
    }, 0);
  }

  function onSearchKey(e: React.KeyboardEvent<HTMLInputElement>, idx: number) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const q = lines[idx].searchQuery.trim().toLowerCase();
    if (!q) return;
    const matches = findMatches(q);
    const exact = matches.find((p) => (p.sku ?? "").toLowerCase() === q);
    const chosen = exact ?? (matches.length === 1 ? matches[0] : null);
    if (chosen) pick(idx, chosen);
  }

  function setQty(idx: number, v: string) {
    const clean = v.replace(/[^\d]/g, "").slice(0, 6);
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, qty: clean } : l)));
  }

  function fixQty(idx: number) {
    setLines((prev) =>
      prev.map((l, i) => (i === idx && (!l.qty || Number(l.qty) < 1) ? { ...l, qty: "1" } : l))
    );
  }

  function onQtyKey(e: React.KeyboardEvent<HTMLInputElement>, idx: number) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    fixQty(idx);
    setTimeout(() => searchRefs.current[idx + 1]?.focus(), 0);
  }

  function addRow() {
    setLines((prev) => [...prev, makeLine()]);
  }

  function removeRow(idx: number) {
    setLines((prev) => normalize(prev.filter((_, i) => i !== idx)));
    setOpenRow(null);
  }

  async function submit() {
    if (!customerName.trim() || !phone.trim()) {
      setError("اسم العميل ورقم الهاتف إجباريان عند إتمام الدفع.");
      return;
    }
    if (validLines.length === 0) {
      setError("يرجى اختيار منتج واحد على الأقل للبيع.");
      return;
    }
    if (overStock.length > 0) {
      setError("بعض الكميات أكبر من المتاح في المخزن.");
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
        if (data.customer) activeCustomerId = data.customer.id;
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
      items: validLines.map((l) => ({
        productId: l.productId,
        quantity: qtyNum(l),
        unitPrice: byId.get(l.productId)?.price ?? 0, // السيرفر يتجاهله ويستخدم سعر الكرت
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

  const field =
    "w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 outline-none";

  return (
    <div dir="rtl" className="space-y-4">
      {/* الفرع والمخزن */}
      <div className="grid grid-cols-1 gap-3 rounded-xl border bg-white p-4 shadow-sm sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-bold text-gray-700">الفرع</label>
          <select className={field} value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold text-gray-700">المستودع (المخزن)</label>
          <select className={field} value={activeWarehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* أسطر الأصناف */}
      <div className="space-y-3 rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between border-b pb-2">
          <h3 className="text-sm font-bold text-gray-800">الأصناف</h3>
          <span className="rounded-full bg-purple-50 px-2.5 py-1 text-xs font-semibold text-purple-700">
            العملة: {currencyLabel}
          </span>
        </div>

        <div className="hidden grid-cols-12 gap-2 px-1 text-xs font-bold text-gray-500 md:grid">
          <div className="col-span-5">المنتج (بحث بالاسم أو الباركود)</div>
          <div className="col-span-2">السعر</div>
          <div className="col-span-2">الكمية</div>
          <div className="col-span-2">الإجمالي</div>
          <div className="col-span-1 text-center">حذف</div>
        </div>

        {lines.map((l, idx) => {
          const p = l.productId ? byId.get(l.productId) : undefined;
          const q = l.searchQuery.trim();
          const matches = !p && q ? findMatches(q) : [];
          const qn = qtyNum(l);
          const stock = p ? stockOf(p) : 0;
          const over = p ? qn > stock : false;

          return (
            <div key={idx} className="grid grid-cols-12 items-start gap-2 border-b pb-3 last:border-0">
              <div className="relative col-span-12 md:col-span-5" data-search-cell>
                <input
                  ref={(el) => {
                    searchRefs.current[idx] = el;
                  }}
                  type="text"
                  autoComplete="off"
                  className={`${field} ${p ? "border-green-400 bg-green-50 font-semibold" : ""}`}
                  placeholder={`${idx + 1}. ابحث بالاسم أو الكود...`}
                  value={l.searchQuery}
                  onChange={(e) => setQuery(idx, e.target.value)}
                  onFocus={() => setOpenRow(idx)}
                  onKeyDown={(e) => onSearchKey(e, idx)}
                />
                {p && (
                  <p className={`mt-1 text-[11px] ${over ? "font-bold text-red-600" : "text-gray-500"}`}>
                    المتاح: {stock}
                    {over ? " — الكمية أكبر من المتاح" : ""}
                  </p>
                )}
                {openRow === idx && matches.length > 0 && (
                  <div className="absolute left-0 right-0 z-30 mt-1 max-h-48 divide-y overflow-y-auto rounded-lg border bg-white shadow-xl">
                    {matches.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => pick(idx, m)}
                        className="flex w-full items-center justify-between px-3 py-2 text-start text-xs hover:bg-purple-50"
                      >
                        <span className="font-semibold text-gray-800">
                          {m.name} {m.sku ? `(${m.sku})` : ""}
                        </span>
                        <span className="rounded bg-purple-100/50 px-2 py-0.5 text-purple-600">
                          متاح: {stockOf(m)} | {fmt(m.price)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="col-span-4 md:col-span-2">
                <div className="mb-1 text-[11px] text-gray-500 md:hidden">السعر</div>
                <div className="rounded-lg bg-gray-50 px-3 py-2 font-mono text-sm font-semibold text-gray-700">
                  {p ? fmt(p.price) : "-"}
                </div>
              </div>

              <div className="col-span-4 md:col-span-2">
                <div className="mb-1 text-[11px] text-gray-500 md:hidden">الكمية</div>
                <input
                  ref={(el) => {
                    qtyRefs.current[idx] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  readOnly={!p}
                  className={`w-full rounded-lg border p-2 text-center text-sm font-bold outline-none focus:ring-2 focus:ring-purple-500 ${
                    p ? (over ? "border-red-400" : "") : "bg-gray-100"
                  }`}
                  value={l.qty}
                  onChange={(e) => setQty(idx, e.target.value)}
                  onBlur={() => fixQty(idx)}
                  onFocus={(e) => e.target.select()}
                  onKeyDown={(e) => onQtyKey(e, idx)}
                />
              </div>

              <div className="col-span-3 md:col-span-2">
                <div className="mb-1 text-[11px] text-gray-500 md:hidden">الإجمالي</div>
                <div className="rounded-lg px-1 py-2 font-mono text-sm font-bold text-purple-700">
                  {p ? fmt(qn * p.price) : fmt(0)}
                </div>
              </div>

              <div className="col-span-1 flex items-end justify-center pt-5 md:pt-0">
                <button
                  type="button"
                  className="rounded bg-red-50 px-2 py-1 text-xs font-bold text-red-500 hover:text-red-700"
                  onClick={() => removeRow(idx)}
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })}

        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={addRow}
            className="rounded-lg border border-purple-300 px-4 py-2 text-xs font-bold text-purple-700 hover:bg-purple-50"
          >
            + إضافة سطر
          </button>
          <span className="text-xs text-gray-500">البنود المضافة: {validLines.length}</span>
        </div>
      </div>

      {/* الخصم */}
      <div className="grid grid-cols-1 gap-3 rounded-xl border bg-white p-4 shadow-sm sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-bold text-gray-700">نوع الخصم</label>
          <select
            className={field}
            value={discountType}
            onChange={(e) => setDiscountType(e.target.value as "NONE" | "PERCENT" | "FIXED")}
          >
            <option value="NONE">بدون خصم</option>
            <option value="PERCENT">خصم نسبة مئوية %</option>
            <option value="FIXED">خصم مبلغ ثابت</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold text-gray-700">قيمة الخصم</label>
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

      {/* الدفع */}
      <div className="space-y-3 rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-gray-800">طرق الدفع والتحصيل</span>
          <button
            type="button"
            className="rounded-md bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700 hover:bg-purple-100"
            onClick={() => {
              setCash(fmt(total));
              setKnet("");
              setCard("");
            }}
          >
            تغطية المبلغ بالكامل (كاش)
          </button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs text-gray-600">كاش (نقدي)</label>
            <input type="number" step="any" className={field} placeholder="0.000" value={cash} onChange={(e) => setCash(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-600">شبكة (كي نت / فيزا)</label>
            <input type="number" step="any" className={field} placeholder="0.000" value={knet} onChange={(e) => setKnet(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-600">بطاقة ائتمانية</label>
            <input type="number" step="any" className={field} placeholder="0.000" value={card} onChange={(e) => setCard(e.target.value)} />
          </div>
        </div>
      </div>

      {/* الملخص */}
      <div className="space-y-1.5 rounded-xl border bg-gray-50 p-4 text-sm shadow-sm">
        <div className="flex justify-between text-gray-600">
          <span>المجموع الفرعي</span>
          <span>{fmt(subtotal)} {currencyLabel}</span>
        </div>
        <div className="flex justify-between text-gray-600">
          <span>قيمة الخصم</span>
          <span>{fmt(discount)} {currencyLabel}</span>
        </div>
        <div className="flex justify-between border-t pt-2 text-base font-bold text-gray-900">
          <span>الإجمالي النهائي</span>
          <span>{fmt(total)} {currencyLabel}</span>
        </div>
      </div>

      {overStock.length > 0 && (
        <p className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-600">
          الكمية أكبر من المتاح في:{" "}
          {overStock.map((l) => byId.get(l.productId)?.name).join("، ")}
        </p>
      )}
      {error && !showCheckoutModal && (
        <p className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-600">{error}</p>
      )}

      <button
        type="button"
        disabled={validLines.length === 0 || overStock.length > 0}
        onClick={() => setShowCheckoutModal(true)}
        className="w-full rounded-xl bg-green-600 py-3.5 text-lg font-bold text-white shadow-md transition hover:bg-green-700 disabled:opacity-50"
      >
        إتمام الدفع وتسجيل العميل 💳 ({fmt(total)} {currencyLabel})
      </button>

      {/* نافذة العميل */}
      {showCheckoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-2xl" dir="rtl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-lg font-bold text-gray-900">بيانات العميل (إجباري)</h3>
              <button
                onClick={() => setShowCheckoutModal(false)}
                className="text-lg font-bold text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-gray-700">
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
              {isSearchingCustomer && <p className="mt-1 text-xs text-purple-600">جاري البحث عن العميل...</p>}
              {customerId && !isSearchingCustomer && (
                <p className="mt-1 text-xs font-medium text-green-600">✓ عميل مسجل مسبقاً، تم جلب البيانات.</p>
              )}
              {isNewCustomer && phone.length >= 3 && (
                <p className="mt-1 text-xs font-medium text-amber-600">⭐ رقم جديد: سيتم حفظه تلقائياً كعميل جديد.</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-gray-700">
                اسم العميل <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="اسم العميل"
                className={field}
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-gray-700">
                البيان / الملاحظات (العنوان، التركيب، التسليم)
              </label>
              <textarea
                rows={3}
                className={field}
                placeholder="اكتب البيان أو تفاصيل العنوان أو التركيب والتسليم..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {error && <p className="rounded-lg bg-red-50 p-2 text-sm font-semibold text-red-600">{error}</p>}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                disabled={saving}
                onClick={submit}
                className="flex-1 rounded-xl bg-purple-600 py-3 font-bold text-white transition hover:bg-purple-700 disabled:opacity-50"
              >
                {saving ? "جاري الحفظ..." : `حفظ وتأكيد (${fmt(total)} ${currencyLabel})`}
              </button>
              <button
                type="button"
                onClick={() => setShowCheckoutModal(false)}
                className="rounded-xl border px-4 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50"
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
