import Link from "next/link";
import type { RecentItem } from "@/lib/dashboard-data";
import { fmtNum } from "@/lib/report-utils";

const KIND = {
  INVOICE: { label: "فاتورة", cls: "bg-purple-100 text-purple-700" },
  RECEIPT: { label: "سند قبض", cls: "bg-green-100 text-green-700" },
  PAYMENT: { label: "سند صرف", cls: "bg-red-100 text-red-700" },
} as const;

export default function RecentActivity({
  items,
  dec,
  currency,
}: {
  items: RecentItem[];
  dec: number;
  currency: string;
}) {
  return (
    <div className="rounded-2xl border bg-white shadow-sm">
      <div className="border-b p-4">
        <h3 className="font-bold text-gray-900">أحدث العمليات</h3>
      </div>

      {items.length === 0 ? (
        <p className="p-8 text-center text-sm text-gray-400">لا توجد عمليات بعد</p>
      ) : (
        <ul className="divide-y">
          {items.map((it) => (
            <li key={`${it.kind}-${it.id}`}>
              <Link
                href={it.href}
                className="flex items-center justify-between gap-3 p-3 hover:bg-gray-50"
              >
                <div className="min-w-0">
                  <div className="mb-0.5 flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${KIND[it.kind].cls}`}
                    >
                      {KIND[it.kind].label}
                    </span>
                    {it.voided && (
                      <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
                        ملغاة
                      </span>
                    )}
                  </div>
                  <p
                    className={`truncate text-sm font-semibold text-gray-900 ${
                      it.voided ? "line-through opacity-60" : ""
                    }`}
                  >
                    {it.title}
                  </p>
                  <p className="truncate text-xs text-gray-500">
                    {it.party} · {it.atLabel}
                  </p>
                </div>
                <div
                  className={`shrink-0 text-end text-sm font-bold tabular-nums ${
                    it.kind === "PAYMENT" ? "text-red-600" : "text-gray-900"
                  } ${it.voided ? "line-through opacity-60" : ""}`}
                >
                  {it.kind === "PAYMENT" ? "-" : ""}
                  {fmtNum(it.amount, dec)}
                  <span className="block text-[10px] font-normal text-gray-400">{currency}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
