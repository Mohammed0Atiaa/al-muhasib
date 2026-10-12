import ReportShell, { NoAccess } from "@/components/report-shell";
import ReportFilters from "@/components/report-filters";
import ReportToolbar from "@/components/report-toolbar";
import { fetchAccounts, fetchTotals, getReportContext } from "@/lib/reports";
import {
  addDays,
  first,
  fmtNum,
  isValidYmd,
  lastMonthRange,
  monthStart,
  qs,
  startOfDayUtc,
  todayInTz,
  yearStart,
} from "@/lib/report-utils";

export const dynamic = "force-dynamic";

const BASE = "/reports/income-statement";

type Line = { code: string; name: string; amount: number };
type G = { code: string; name: string; type: string; lines: Line[]; total: number };
type Row = {
  kind: "section" | "group" | "account" | "subtotal" | "grand";
  label: string;
  code?: string;
  amount?: number;
  pct?: number | null;
};

export default async function IncomeStatementPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const ctx = await getReportContext();

  if (!ctx.allowed) {
    return (
      <ReportShell currentPath={BASE}>
        <NoAccess />
      </ReportShell>
    );
  }

  const dec = ctx.decimals;
  const eps = 0.5 * Math.pow(10, -dec);
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

  const [accounts, totals] = await Promise.all([
    fetchAccounts(ctx.companyId),
    fetchTotals({
      companyId: ctx.companyId,
      from: startOfDayUtc(from, ctx.tz),
      toExclusive: startOfDayUtc(addDays(to, 1), ctx.tz),
      branchId: branchId || null,
    }),
  ]);

  const byCode = new Map(accounts.map((a) => [a.code, a]));
  const groups = new Map<string, G>();

  for (const a of accounts) {
    if (a.isGroup || (a.type !== "REVENUE" && a.type !== "EXPENSE")) continue;
    const t = totals.get(a.id);
    if (!t) continue;
    // الإيراد = دائن - مدين، والمصروف = مدين - دائن (الحسابات العكسية تطلع بالسالب)
    const amount = a.type === "REVENUE" ? t.pc - t.pd : t.pd - t.pc;
    if (Math.abs(amount) < eps) continue;

    const key = a.parentCode && byCode.has(a.parentCode) ? a.parentCode : `__${a.type}`;
    let g = groups.get(key);
    if (!g) {
      const unclassified = key.startsWith("__");
      g = {
        code: unclassified ? "" : key,
        name: unclassified
          ? a.type === "REVENUE"
            ? "إيرادات أخرى"
            : "مصروفات أخرى"
          : byCode.get(key)!.name,
        type: a.type,
        lines: [],
        total: 0,
      };
      groups.set(key, g);
    }
    g.lines.push({ code: a.code, name: a.name, amount });
    g.total += amount;
  }

  const list = [...groups.values()].sort((x, y) =>
    x.code < y.code ? -1 : x.code > y.code ? 1 : 0
  );
  const salesG = list.filter((g) => g.type === "REVENUE" && g.code === "40");
  const otherIncG = list.filter((g) => g.type === "REVENUE" && g.code !== "40");
  const cogsG = list.filter((g) => g.type === "EXPENSE" && g.code === "50");
  const otherExpG = list.filter((g) => g.type === "EXPENSE" && g.code === "59");
  const opexG = list.filter(
    (g) => g.type === "EXPENSE" && g.code !== "50" && g.code !== "59"
  );

  const sum = (gs: G[]) => gs.reduce((s, g) => s + g.total, 0);
  const netSales = sum(salesG);
  const cogs = sum(cogsG);
  const gross = netSales - cogs;
  const opex = sum(opexG);
  const operating = gross - opex;
  const otherInc = sum(otherIncG);
  const otherExp = sum(otherExpG);
  const net = operating + otherInc - otherExp;

  const pct = (v: number): number | null => (netSales !== 0 ? (v / netSales) * 100 : null);

  const rows: Row[] = [];
  const pushGroups = (gs: G[]) => {
    for (const g of gs) {
      rows.push({ kind: "group", label: g.name, code: g.code, amount: g.total });
      for (const l of g.lines) {
        rows.push({ kind: "account", label: l.name, code: l.code, amount: l.amount });
      }
    }
  };

  rows.push({ kind: "section", label: "الإيرادات" });
  pushGroups(salesG);
  rows.push({ kind: "subtotal", label: "صافي المبيعات", amount: netSales });

  rows.push({ kind: "section", label: "تكلفة المبيعات" });
  pushGroups(cogsG);
  rows.push({ kind: "subtotal", label: "إجمالي تكلفة المبيعات", amount: cogs });
  rows.push({ kind: "grand", label: "مجمل الربح", amount: gross, pct: pct(gross) });

  rows.push({ kind: "section", label: "المصروفات التشغيلية" });
  pushGroups(opexG);
  rows.push({ kind: "subtotal", label: "إجمالي المصروفات التشغيلية", amount: opex });
  rows.push({
    kind: "grand",
    label: "صافي الربح التشغيلي",
    amount: operating,
    pct: pct(operating),
  });

  if (otherIncG.length > 0) {
    rows.push({ kind: "section", label: "إيرادات أخرى" });
    pushGroups(otherIncG);
    rows.push({ kind: "subtotal", label: "إجمالي الإيرادات الأخرى", amount: otherInc });
  }
  if (otherExpG.length > 0) {
    rows.push({ kind: "section", label: "مصروفات وخسائر أخرى" });
    pushGroups(otherExpG);
    rows.push({ kind: "subtotal", label: "إجمالي المصروفات والخسائر الأخرى", amount: otherExp });
  }
  rows.push({
    kind: "grand",
    label: net >= 0 ? "صافي الربح للفترة" : "صافي الخسارة للفترة",
    amount: net,
    pct: pct(net),
  });

  const branchLabel = branchId
    ? ctx.branches.find((b) => b.id === branchId)?.name ?? ""
    : "كل الفروع";
  const periodLabel = `من ${from} إلى ${to}`;
  const hasData = list.length > 0;

  const lm = lastMonthRange(today);
  const keep = { branch: branchId || undefined };
  const presets = [
    { label: "هذا الشهر", href: `${BASE}${qs({ from: monthStart(today), to: today, ...keep })}` },
    { label: "الشهر الماضي", href: `${BASE}${qs({ from: lm.from, to: lm.to, ...keep })}` },
    { label: "هذا العام", href: `${BASE}${qs({ from: yearStart(today), to: today, ...keep })}` },
  ];

  const csvRows: (string | number)[][] = [
    ["قائمة الدخل"],
    [ctx.companyName],
    [periodLabel],
    [`الفرع: ${branchLabel}`, `العملة: ${ctx.baseCurrency}`],
    [],
    ["البند", "الكود", "المبلغ", "النسبة من صافي المبيعات"],
    ...rows.map((rw) => [
      rw.label,
      rw.code ?? "",
      rw.amount === undefined ? "" : Number(rw.amount.toFixed(dec)),
      rw.pct === undefined || rw.pct === null ? "" : `${rw.pct.toFixed(1)}%`,
    ]),
  ];

  const num = "border p-2 text-end font-mono tabular-nums";

  return (
    <ReportShell currentPath={BASE}>
      <style>{`@page { size: A4 portrait; margin: 12mm; }`}</style>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <h1 className="text-2xl font-bold text-gray-900">قائمة الدخل</h1>
        <ReportToolbar filename={`income-statement-${from}-${to}`} rows={csvRows} />
      </div>

      <ReportFilters
        from={from}
        to={to}
        branchId={branchId}
        branches={ctx.branches}
        showZero={null}
        presets={presets}
      />

      <div className="rounded-xl border bg-white p-4 shadow-sm print:border-0 print:p-0 print:shadow-none">
        <div className="mb-4 text-center">
          <h2 className="text-lg font-bold">{ctx.companyName}</h2>
          <p className="text-base font-semibold">قائمة الدخل</p>
          <p className="text-sm text-gray-600">{periodLabel}</p>
          <p className="text-xs text-gray-500">
            {branchLabel} — العملة: {ctx.baseCurrency}
          </p>
        </div>

        <div
          className={`mb-4 rounded-lg border p-4 text-center ${
            net >= 0
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          <p className="text-sm font-semibold">
            {net >= 0 ? "صافي الربح" : "صافي الخسارة"}
          </p>
          <p className="text-2xl font-extrabold">
            {fmtNum(Math.abs(net), dec)} {ctx.baseCurrency}
          </p>
          {pct(net) !== null && (
            <p className="text-xs">هامش صافي الربح: {pct(net)!.toFixed(1)}% من صافي المبيعات</p>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-gray-100 text-gray-700">
              <tr>
                <th className="border p-2 text-start">البند</th>
                <th className="border p-2 text-start">الكود</th>
                <th className="border p-2 text-end">المبلغ ({ctx.baseCurrency})</th>
                <th className="border p-2 text-end">% من المبيعات</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((rw, i) => {
                if (rw.kind === "section") {
                  return (
                    <tr key={i} className="bg-gray-200">
                      <td colSpan={4} className="border p-2 font-extrabold">
                        {rw.label}
                      </td>
                    </tr>
                  );
                }
                const amount = rw.amount ?? 0;
                const pctCell =
                  rw.pct === undefined || rw.pct === null ? "" : `${rw.pct.toFixed(1)}%`;
                const base =
                  rw.kind === "group"
                    ? "bg-gray-50 font-semibold"
                    : rw.kind === "subtotal"
                    ? "bg-gray-100 font-bold"
                    : rw.kind === "grand"
                    ? amount >= 0
                      ? "bg-green-50 font-extrabold text-green-800"
                      : "bg-red-50 font-extrabold text-red-800"
                    : "";
                const indent = rw.kind === "account" ? 32 : rw.kind === "group" ? 16 : 8;
                return (
                  <tr key={i} className={base}>
                    <td className="border p-2" style={{ paddingInlineStart: `${indent}px` }}>
                      {rw.label}
                    </td>
                    <td className="border p-2 font-mono text-xs text-gray-500">{rw.code ?? ""}</td>
                    <td className={num}>{fmtNum(amount, dec)}</td>
                    <td className={num}>{pctCell}</td>
                  </tr>
                );
              })}
              {!hasData && (
                <tr>
                  <td colSpan={4} className="border p-8 text-center text-gray-400">
                    لا توجد حركات إيرادات أو مصروفات في هذه الفترة
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </ReportShell>
  );
}
