import Link from "next/link";

export default function ReportFilters({
  from,
  to,
  branchId,
  branches,
  showZero,
  presets,
}: {
  from: string;
  to: string;
  branchId: string;
  branches: { id: string; name: string }[];
  showZero: boolean | null;
  presets: { label: string; href: string }[];
}) {
  const field = "w-full rounded-lg border px-3 py-2 text-sm";
  const label = "mb-1 block text-xs font-bold text-gray-700";

  return (
    <form
      key={`${from}|${to}|${branchId}|${showZero}`}
      method="get"
      dir="rtl"
      className="mb-4 space-y-3 rounded-xl border bg-white p-4 shadow-sm print:hidden"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div>
          <label className={label}>من تاريخ</label>
          <input type="date" name="from" defaultValue={from} className={field} />
        </div>
        <div>
          <label className={label}>إلى تاريخ</label>
          <input type="date" name="to" defaultValue={to} className={field} />
        </div>
        {branches.length > 1 && (
          <div>
            <label className={label}>الفرع</label>
            <select name="branch" defaultValue={branchId} className={field}>
              <option value="">كل الفروع</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="flex items-end">
          <button
            type="submit"
            className="w-full rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white"
          >
            عرض التقرير
          </button>
        </div>
      </div>

      {showZero !== null && (
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" name="zero" value="1" defaultChecked={showZero} />
          إظهار الحسابات التي ليس عليها حركة
        </label>
      )}

      <div className="flex flex-wrap gap-2 text-xs">
        {presets.map((p) => (
          <Link
            key={p.label}
            href={p.href}
            className="rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-purple-700"
          >
            {p.label}
          </Link>
        ))}
      </div>
    </form>
  );
}
