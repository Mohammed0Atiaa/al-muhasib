import Link from "next/link";
import { Landmark, Package, TrendingUp, Wallet } from "lucide-react";
import Sidebar from "@/components/sidebar";
import KpiCard, { Stat } from "@/components/dashboard/kpi-card";
import DateFilter from "@/components/dashboard/date-filter";
import RecentActivity from "@/components/dashboard/recent-activity";
import { RevenueExpenseChart, Sparkline } from "@/components/dashboard/charts";
import { getReportContext } from "@/lib/reports";
import { loadDashboard } from "@/lib/dashboard-data";
import {
  first,
  fmtNum,
  isValidYmd,
  monthStart,
  qs,
  todayInTz,
  yearStart,
} from "@/lib/report-utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const ctx = await getReportContext();
  const dec = ctx.decimals;
  const cur = ctx.baseCurrency;
  const f = (v: number) => fmtNum(v, dec);
  const today = todayInTz(ctx.tz);

  const fromRaw = first(sp.from);
  const toRaw = first(sp.to);
  let from: string = isValidYmd(fromRaw) ? fromRaw : monthStart(today);
  let to: string = isValidYmd(toRaw) ? toRaw : today;
  if (from > to) [from, to] = [to, from];

  const branchParam = first(sp.branch);
  const branchId =
    ctx.forcedBranchId ??
    (ctx.branches.some((b) => b.id === branchParam) ? (branchParam as string) : "");

  const showFinance = ctx.allowed;
  const data = await loadDashboard({ ctx, from, to, branchId, finance: showFinance });
  const { inventory, sales, finance: fin, recent } = data;

  const branchQ = branchId || undefined;
  const presets = [
    {
      key: "today" as const,
      label: "اليوم",
      href: `/dashboard${qs({ from: today, to: today, branch: branchQ })}`,
    },
    {
      key: "month" as const,
      label: "هذا الشهر",
      href: `/dashboard${qs({ from: monthStart(today), to: today, branch: branchQ })}`,
    },
    {
      key: "year" as const,
      label: "هذا العام",
      href: `/dashboard${qs({ from: yearStart(today), to: today, branch: branchQ })}`,
    },
  ];
  const active: "today" | "month" | "year" | "custom" =
    from === today && to === today
      ? "today"
      : from === monthStart(today) && to === today
      ? "month"
      : from === yearStart(today) && to === today
      ? "year"
      : "custom";

  const periodQ = qs({ from, to, branch: branchQ });
  const branchLabel = branchId
    ? ctx.branches.find((b) => b.id === branchId)?.name ?? ""
    : "كل الفروع";

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar currentPath="/dashboard" />
      <main dir="rtl" className="ml-64 p-4 md:p-8">
        <div className="mx-auto max-w-7xl space-y-6">
          {/* الترويسة */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">لوحة التحكم</h1>
              <p className="text-sm text-gray-500">
                {ctx.companyName} — {branchLabel} — الفترة: من {from} إلى {to}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/sales/new"
                className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white"
              >
                + فاتورة جديدة
              </Link>
              <Link
                href="/customers/receipts/new"
                className="rounded-lg border bg-white px-4 py-2 text-sm font-medium text-gray-700"
              >
                + سند قبض
              </Link>
            </div>
          </div>

          {/* فلتر الفترة */}
          <DateFilter
            from={from}
            to={to}
            branchId={branchId}
            branches={ctx.branches}
            active={active}
            presets={presets}
          />

          {/* البطاقات الأربع */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {/* المخزون */}
            <KpiCard
              title="المخزون"
              icon={<Package className="h-5 w-5" />}
              accent="bg-amber-100 text-amber-700"
              href="/inventory"
              linkLabel="فتح المخزون"
            >
              <Stat
                label="قيمة المخزون (بالتكلفة)"
                value={f(inventory.costValue)}
                unit={cur}
                sub={`بسعر البيع: ${f(inventory.retailValue)}`}
                hint={
                  inventory.noCost > 0
                    ? `${inventory.noCost} منتج بدون سعر تكلفة، فالقيمة بالتكلفة غير مكتملة`
                    : undefined
                }
              />
              <Stat
                label="عدد المنتجات"
                value={String(inventory.products)}
                sub={`إجمالي الوحدات: ${inventory.units.toLocaleString("en-US")}`}
              />
              <Stat
                label="أصناف منخفضة المخزون"
                value={String(inventory.lowStock)}
                tone={inventory.lowStock > 0 ? "bad" : "default"}
                sub={`منها نافد: ${inventory.outOfStock}`}
              />
              <p className="text-[11px] text-gray-400">أرقام المخزون لحظية ولا تتأثر بالفترة.</p>
            </KpiCard>

            {/* المبيعات */}
            <KpiCard
              title="المبيعات والإيرادات"
              icon={<TrendingUp className="h-5 w-5" />}
              accent="bg-purple-100 text-purple-700"
              href="/sales"
              linkLabel="فتح الفواتير"
            >
              <Stat label="إجمالي مبيعات الفترة" value={f(sales.total)} unit={cur} />
              <Sparkline data={sales.series} decimals={dec} currency={cur} />
              <div className="grid grid-cols-2 gap-3">
                <Stat label="عدد الفواتير" value={String(sales.count)} />
                <Stat label="متوسط الفاتورة" value={f(sales.avg)} unit={cur} />
              </div>
              <Stat
                label="فواتير آجلة مفتوحة"
                value={String(sales.openCredit)}
                tone={sales.openCredit > 0 ? "warn" : "default"}
              />
            </KpiCard>

            {/* المصروفات */}
            {fin && (
              <KpiCard
                title="المصروفات وسندات الصرف"
                icon={<Wallet className="h-5 w-5" />}
                accent="bg-red-100 text-red-700"
                href={`/reports/income-statement${periodQ}`}
                linkLabel="قائمة الدخل"
              >
                <Stat label="إجمالي المصروفات" value={f(fin.expenses)} unit={cur} />
                <div className="space-y-1 rounded-lg bg-gray-50 p-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">مصروفات تشغيلية</span>
                    <span className="font-semibold tabular-nums">{f(fin.opex)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">تكلفة المبيعات</span>
                    <span className="font-semibold tabular-nums">{f(fin.cogs)}</span>
                  </div>
                </div>
                <Stat
                  label={fin.net >= 0 ? "صافي الربح" : "صافي الخسارة"}
                  value={f(Math.abs(fin.net))}
                  unit={cur}
                  tone={fin.net >= 0 ? "good" : "bad"}
                />
                <Stat label="سندات الصرف في الفترة" value={String(fin.paymentCount)} />
              </KpiCard>
            )}

            {/* الحسابات والذمم */}
            {fin && (
              <KpiCard
                title="الحسابات والذمم المالية"
                icon={<Landmark className="h-5 w-5" />}
                accent="bg-blue-100 text-blue-700"
                href={`/reports/trial-balance${periodQ}`}
                linkLabel="ميزان المراجعة"
              >
                <Stat
                  label="النقدية والبنوك"
                  value={f(fin.cashTotal)}
                  unit={cur}
                  sub={`حتى ${to}`}
                />
                {fin.cashLines.length > 0 && (
                  <div className="space-y-1 rounded-lg bg-gray-50 p-2 text-xs">
                    {fin.cashLines.slice(0, 4).map((l) => (
                      <div key={l.code} className="flex justify-between gap-2">
                        <span className="truncate text-gray-500">{l.name}</span>
                        <span className="font-semibold tabular-nums">{f(l.balance)}</span>
                      </div>
                    ))}
                  </div>
                )}
                <Stat
                  label="ذمم العملاء المستحقة"
                  value={f(fin.receivables)}
                  unit={cur}
                  tone={fin.receivables > 0 ? "warn" : "default"}
                  sub={`حتى ${to}`}
                />
              </KpiCard>
            )}
          </div>

          {/* الرسم البياني + أحدث العمليات */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            {fin && (
              <div className="rounded-2xl border bg-white shadow-sm xl:col-span-2">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
                  <h3 className="font-bold text-gray-900">الإيرادات مقابل المصروفات</h3>
                  <div className="flex flex-wrap gap-4 text-xs">
                    <span className="text-green-700">
                      الإيرادات: <b className="tabular-nums">{f(fin.revenue)}</b>
                    </span>
                    <span className="text-red-600">
                      المصروفات: <b className="tabular-nums">{f(fin.expenses)}</b>
                    </span>
                    <span className={fin.net >= 0 ? "text-purple-700" : "text-red-600"}>
                      الصافي: <b className="tabular-nums">{f(fin.net)}</b> {cur}
                    </span>
                  </div>
                </div>
                <div className="p-4">
                  <RevenueExpenseChart data={fin.chart} decimals={dec} currency={cur} />
                  <p className="mt-2 text-[11px] text-gray-400">
                    المصروفات هنا شاملة تكلفة المبيعات، فالصافي يطابق قائمة الدخل.
                  </p>
                </div>
              </div>
            )}

            <div className={fin ? "xl:col-span-1" : "xl:col-span-3"}>
              <RecentActivity items={recent} dec={dec} currency={cur} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
