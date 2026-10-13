import Link from "next/link";

type Key = "today" | "month" | "year";

export default function DateFilter({
  from,
  to,
  branchId,
  branches,
  active,
  presets,
}: {
  from: string;
  to: string;
  branchId: string;
  branches: { id: string; name: string }[];
  active: Key | "custom";
  presets: { key: Key; label: string; href: string }[];
}) {
  const field = "w-full rounded-lg border px-3 py-2 text-sm";
  const label = "mb-1 block text-xs font-bold text-gray-700";

  return (
    <form
      key={`${from}|${to}|${branchId}`}
      method="get"
      dir="rtl"
      className="space-y-3 rounded-xl border bg-white p-4 shadow-sm"
    >
      <div className="flex flex-wrap gap-2">
        {presets.map((p) => (
          <Link
            key={p.key}
            href={p.href}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
              active === p.key
                ? "bg-purple-600 text-white"
                : "border border-purple-200 bg-purple-50 text-purple-700"
            }`}
          >
            {p.label}
          </Link>
        ))}
        <span
          className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
            active === "custom"
              ? "bg-purple-600 text-white"
              : "border border-gray-200 text-gray-400"
          }`}
        >
          فترة مخصصة
        </span>
      </div>

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
            تطبيق
          </button>
        </div>
      </div>
    </form>
  );
}
