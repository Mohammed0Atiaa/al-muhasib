import ReportShell, { NoAccess } from "@/components/report-shell";
import ReportFilters from "@/components/report-filters";
import ReportToolbar from "@/components/report-toolbar";
import {
  buildTree,
  fetchAccounts,
  fetchTotals,
  getReportContext,
  type TreeNode,
} from "@/lib/reports";
import {
  addDays,
  first,
  fmtNum,
  fmtOrDash,
  isValidYmd,
  monthStart,
  qs,
  startOfDayUtc,
  todayInTz,
  yearStart,
} from "@/lib/report-utils";

export const dynamic = "force-dynamic";

const BASE = "/reports/trial-balance";

export default async function TrialBalancePage({
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
  let from: string | null = isValidYmd(fromRaw) ? fromRaw : null;
  let to: string = isValidYmd(toRaw) ? toRaw : today;
  if (from && from > to) [from, to] = [to, from];

  const branchParam = first(sp.branch);
  const branchId =
    ctx.forcedBranchId ??
    (ctx.branches.some((b) => b.id === branchParam) ? (branchParam as string) : "");
  const showZero = first(sp.zero) === "1";

  const fromDate = from ? startOfDayUtc(from, ctx.tz) : new Date("1970-01-01T00:00:00Z");
  const toExclusive = startOfDayUtc(addDays(to, 1), ctx.tz);

  const [accounts, totals] = await Promise.all([
    fetchAccounts(ctx.companyId),
    fetchTotals({
      companyId: ctx.companyId,
      from: fromDate,
      toExclusive,
      branchId: branchId || null,
    }),
  ]);

  const tree = buildTree(accounts, totals);
  const visible: TreeNode[] = showZero ? tree : tree.filter((n) => n.hasActivity);
  const showOpening = !!from;

  const cells = (n: TreeNode) => {
    const open = n.tot.od - n.tot.oc;
    const close = open + n.tot.pd - n.tot.pc;
    return {
      oD: Math.max(open, 0),
      oC: Math.max(-open, 0),
      pD: n.tot.pd,
      pC: n.tot.pc,
      cD: Math.max(close, 0),
      cC: Math.max(-close, 0),
      close,
    };
  };

  // المجاميع من الحسابات الفرعية فقط (لتفادي التكرار مع المجموعات)
  let opD = 0, opC = 0, mvD = 0, mvC = 0, clD = 0, clC = 0;
  for (const n of tree) {
    if (n.isGroup || !n.hasActivity) continue;
    const c = cells(n);
    opD += c.oD; opC += c.oC;
    mvD += c.pD; mvC += c.pC;
    clD += c.cD; clC += c.cC;
  }
  const balanced =
    Math.abs(opD - opC) < eps && Math.abs(mvD - mvC) < eps && Math.abs(clD - clC) < eps;
  const diff = Math.max(Math.abs(opD - opC), Math.abs(mvD - mvC), Math.abs(clD - clC));

  const f = (n: number) => fmtOrDash(n, dec);
  const r = (n: number) => Number(n.toFixed(dec));
  const branchLabel = branchId
    ? ctx.branches.find((b) => b.id === branchId)?.name ?? ""
    : "كل الفروع";
  const periodLabel = `${from ? `من ${from}` : "من بداية التعامل"} إلى ${to}`;

  const keep = { branch: branchId || undefined, zero: showZero ? "1" : undefined };
  const presets = [
    { label: "الكل حتى اليوم", href: `${BASE}${qs({ to: today, ...keep })}` },
    { label: "هذا الشهر", href: `${BASE}${qs({ from: monthStart(today), to: today, ...keep })}` },
    { label: "هذا العام", href: `${BASE}${qs({ from: yearStart(today), to: today, ...keep })}` },
  ];

  const csvRows: (string | number)[][] = [
    ["ميزان المراجعة"],
    [ctx.companyName],
    [periodLabel],
    [`الفرع: ${branchLabel}`, `العملة: ${ctx.baseCurrency}`],
    [],
    [
      "الكود",
      "اسم الحساب",
      ...(showOpening ? ["أول المدة مدين", "أول المدة دائن"] : []),
      "حركة مدين",
      "حركة دائن",
      "رصيد ختامي مدين",
      "رصيد ختامي دائن",
    ],
    ...visible.map((n) => {
      const c = cells(n);
      return [
        n.code,
        n.name,
        ...(showOpening ? [r(c.oD), r(c.oC)] : []),
        r(c.pD),
        r(c.pC),
        r(c.cD),
        r(c.cC),
      ];
    }),
    [
      "",
      "الإجمالي",
      ...(showOpening ? [r(opD), r(opC)] : []),
      r(mvD),
      r(mvC),
      r(clD),
      r(clC),
    ],
    [balanced ? "الميزان متوازن" : `الميزان غير متوازن - الفرق ${r(diff)}`],
  ];

  const num = "border p-2 text-end font-mono tabular-nums";

  return (
    <ReportShell currentPath={BASE}>
      <style>{`@page { size: A4 landscape; margin: 10mm; }`}</style>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <h1 className="text-2xl font-bold text-gray-900">ميزان المراجعة</h1>
        <ReportToolbar filename={`trial-balance-${to}`} rows={csvRows} />
      </div>

      <ReportFilters
        from={from ?? ""}
        to={to}
        branchId={branchId}
        branches={ctx.branches}
        showZero={showZero}
        presets={presets}
      />

      <div className="rounded-xl border bg-white p-4 shadow-sm print:border-0 print:p-0 print:shadow-none">
        <div className="mb-4 text-center">
          <h2 className="text-lg font-bold">{ctx.companyName}</h2>
          <p className="text-base font-semibold">ميزان المراجعة</p>
          <p className="text-sm text-gray-600">{periodLabel}</p>
          <p className="text-xs text-gray-500">
            {branchLabel} — العملة: {ctx.baseCurrency}
          </p>
        </div>

        <div
          className={`mb-4 rounded-lg border p-3 text-sm font-bold ${
            balanced
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {balanced
            ? "✓ الميزان متوازن: إجمالي المدين يساوي إجمالي الدائن"
            : `✗ الميزان غير متوازن — الفرق ${fmtNum(diff, dec)}`}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-gray-100 text-gray-700">
              <tr>
                <th rowSpan={2} className="border p-2 text-start">الكود</th>
                <th rowSpan={2} className="border p-2 text-start">اسم الحساب</th>
                {showOpening && (
                  <th colSpan={2} className="border p-2 text-center">رصيد أول المدة</th>
                )}
                <th colSpan={2} className="border p-2 text-center">حركة الفترة</th>
                <th colSpan={2} className="border p-2 text-center">الرصيد الختامي</th>
              </tr>
              <tr>
                {showOpening && (
                  <>
                    <th className="border p-2 text-center">مدين</th>
                    <th className="border p-2 text-center">دائن</th>
                  </>
                )}
                <th className="border p-2 text-center">مدين</th>
                <th className="border p-2 text-center">دائن</th>
                <th className="border p-2 text-center">مدين</th>
                <th className="border p-2 text-center">دائن</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((n) => {
                const c = cells(n);
                const abnormal =
                  !n.isGroup &&
                  ((n.nature === "DEBIT" && c.close < -eps) ||
                    (n.nature === "CREDIT" && c.close > eps));
                const rowCls =
                  n.level === 0
                    ? "bg-gray-200 font-extrabold"
                    : n.isGroup
                    ? "bg-gray-50 font-bold"
                    : "";
                return (
                  <tr key={n.id} className={rowCls}>
                    <td className="border p-2 font-mono">{n.code}</td>
                    <td
                      className="border p-2"
                      style={{ paddingInlineStart: `${8 + n.level * 16}px` }}
                    >
                      {n.name}
                      {abnormal && (
                        <span className="mr-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                          رصيد عكسي
                        </span>
                      )}
                    </td>
                    {showOpening && (
                      <>
                        <td className={num}>{f(c.oD)}</td>
                        <td className={num}>{f(c.oC)}</td>
                      </>
                    )}
                    <td className={num}>{f(c.pD)}</td>
                    <td className={num}>{f(c.pC)}</td>
                    <td className={num}>{f(c.cD)}</td>
                    <td className={num}>{f(c.cC)}</td>
                  </tr>
                );
              })}
              {visible.length === 0 && (
                <tr>
                  <td
                    colSpan={showOpening ? 8 : 6}
                    className="border p-8 text-center text-gray-400"
                  >
                    لا توجد حركات في هذه الفترة
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot className="bg-gray-100 font-bold">
              <tr>
                <td className="border p-2" colSpan={2}>الإجمالي</td>
                {showOpening && (
                  <>
                    <td className={num}>{fmtNum(opD, dec)}</td>
                    <td className={num}>{fmtNum(opC, dec)}</td>
                  </>
                )}
                <td className={num}>{fmtNum(mvD, dec)}</td>
                <td className={num}>{fmtNum(mvC, dec)}</td>
                <td className={num}>{fmtNum(clD, dec)}</td>
                <td className={num}>{fmtNum(clC, dec)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </ReportShell>
  );
}
