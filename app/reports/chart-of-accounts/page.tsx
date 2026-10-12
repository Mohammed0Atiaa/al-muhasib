import ReportShell, { NoAccess } from "@/components/report-shell";
import ReportToolbar from "@/components/report-toolbar";
import { buildTree, fetchAccounts, fetchTotals, getReportContext } from "@/lib/reports";
import { addDays, first, fmtNum, startOfDayUtc, todayInTz } from "@/lib/report-utils";

export const dynamic = "force-dynamic";

const BASE = "/reports/chart-of-accounts";

const TYPE_LABEL: Record<string, string> = {
  ASSET: "أصول",
  LIABILITY: "خصوم",
  EQUITY: "حقوق ملكية",
  REVENUE: "إيرادات",
  EXPENSE: "مصروفات",
};

export default async function ChartOfAccountsPage({
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
  const today = todayInTz(ctx.tz);

  const [accounts, totals] = await Promise.all([
    fetchAccounts(ctx.companyId),
    fetchTotals({
      companyId: ctx.companyId,
      from: new Date("1970-01-01T00:00:00Z"),
      toExclusive: startOfDayUtc(addDays(today, 1), ctx.tz),
      branchId: ctx.forcedBranchId,
    }),
  ]);

  const tree = buildTree(accounts, totals);

  const q = (first(sp.q) ?? "").trim().toLowerCase();
  const typeRaw = first(sp.type) ?? "";
  const typeFilter = typeRaw in TYPE_LABEL ? typeRaw : "";

  let visible = tree;
  if (q || typeFilter) {
    const byCode = new Map(tree.map((n) => [n.code, n]));
    const keep = new Set<string>();
    for (const n of tree) {
      const matchQ =
        !q || n.code.toLowerCase().includes(q) || n.name.toLowerCase().includes(q);
      const matchT = !typeFilter || n.type === typeFilter;
      if (!(matchQ && matchT)) continue;
      let c: string | null = n.code;
      const seen = new Set<string>();
      while (c && !seen.has(c) && byCode.has(c)) {
        seen.add(c);
        keep.add(c);
        c = byCode.get(c)!.parentCode;
      }
    }
    visible = tree.filter((n) => keep.has(n.code));
  }

  const leafCount = tree.filter((n) => !n.isGroup).length;
  const groupCount = tree.length - leafCount;

  // الرصيد الحالي باتجاه طبيعة الحساب
  const balanceOf = (n: (typeof tree)[number]) => {
    const net = n.tot.pd - n.tot.pc + (n.tot.od - n.tot.oc);
    return n.nature === "DEBIT" ? net : -net;
  };

  const csvRows: (string | number)[][] = [
    ["شجرة الحسابات"],
    [ctx.companyName],
    [`الرصيد حتى ${today} (العملة: ${ctx.baseCurrency})`],
    [],
    ["الكود", "اسم الحساب", "النوع", "الطبيعة", "الرصيد الحالي"],
    ...visible.map((n) => [
      n.code,
      n.name,
      TYPE_LABEL[n.type] ?? n.type,
      n.nature === "DEBIT" ? "مدين" : "دائن",
      Number(balanceOf(n).toFixed(dec)),
    ]),
  ];

  const field = "w-full rounded-lg border px-3 py-2 text-sm";

  return (
    <ReportShell currentPath={BASE}>
      <style>{`@page { size: A4 portrait; margin: 12mm; }`}</style>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">شجرة الحسابات</h1>
          <p className="text-sm text-gray-500">
            {leafCount} حساب فرعي في {groupCount} مجموعة
          </p>
        </div>
        <ReportToolbar filename={`chart-of-accounts-${today}`} rows={csvRows} />
      </div>

      <form
        key={`${q}|${typeFilter}`}
        method="get"
        dir="rtl"
        className="mb-4 grid grid-cols-1 gap-3 rounded-xl border bg-white p-4 shadow-sm sm:grid-cols-3 print:hidden"
      >
        <div className="sm:col-span-1">
          <label className="mb-1 block text-xs font-bold text-gray-700">بحث بالكود أو الاسم</label>
          <input name="q" defaultValue={q} className={field} placeholder="مثال: 1010 أو الصندوق" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold text-gray-700">النوع</label>
          <select name="type" defaultValue={typeFilter} className={field}>
            <option value="">كل الأنواع</option>
            {Object.entries(TYPE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            className="w-full rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white"
          >
            بحث
          </button>
        </div>
      </form>

      <div className="rounded-xl border bg-white p-4 shadow-sm print:border-0 print:p-0 print:shadow-none">
        <div className="mb-4 text-center">
          <h2 className="text-lg font-bold">{ctx.companyName}</h2>
          <p className="text-base font-semibold">شجرة الحسابات</p>
          <p className="text-xs text-gray-500">
            الأرصدة حتى {today} — العملة: {ctx.baseCurrency}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-gray-100 text-gray-700">
              <tr>
                <th className="border p-2 text-start">الكود</th>
                <th className="border p-2 text-start">اسم الحساب</th>
                <th className="border p-2 text-start">النوع</th>
                <th className="border p-2 text-start">الطبيعة</th>
                <th className="border p-2 text-end">الرصيد الحالي</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((n) => {
                const bal = balanceOf(n);
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
                    </td>
                    <td className="border p-2">{TYPE_LABEL[n.type] ?? n.type}</td>
                    <td className="border p-2">{n.nature === "DEBIT" ? "مدين" : "دائن"}</td>
                    <td
                      className={`border p-2 text-end font-mono tabular-nums ${
                        bal < 0 ? "text-red-600" : ""
                      }`}
                    >
                      {n.hasActivity ? fmtNum(bal, dec) : "-"}
                    </td>
                  </tr>
                );
              })}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={5} className="border p-8 text-center text-gray-400">
                    لا توجد حسابات مطابقة
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-xs text-gray-500 print:hidden">
          الرصيد بين قوسين وباللون الأحمر معناه رصيد عكسي لطبيعة الحساب. شاشة إضافة وتعديل
          الحسابات هنبنيها لاحقاً.
        </p>
      </div>
    </ReportShell>
  );
}
