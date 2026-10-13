import Link from "next/link";
import type { ReactNode } from "react";

export default function KpiCard({
  title,
  icon,
  accent,
  href,
  linkLabel,
  children,
}: {
  title: string;
  icon: ReactNode;
  accent: string;
  href: string;
  linkLabel: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col rounded-2xl border bg-white shadow-sm transition hover:shadow-md">
      <div className="flex items-center justify-between border-b p-4">
        <h3 className="font-bold text-gray-900">{title}</h3>
        <span className={`rounded-xl p-2 ${accent}`}>{icon}</span>
      </div>
      <div className="flex-1 space-y-4 p-4">{children}</div>
      <div className="border-t p-3">
        <Link
          href={href}
          className="block rounded-lg bg-gray-50 py-2 text-center text-sm font-semibold text-purple-700 hover:bg-purple-50"
        >
          {linkLabel} ←
        </Link>
      </div>
    </div>
  );
}

export function Stat({
  label,
  value,
  unit,
  sub,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  hint?: string;
  tone?: "default" | "good" | "bad" | "warn";
}) {
  const color =
    tone === "good"
      ? "text-green-700"
      : tone === "bad"
      ? "text-red-600"
      : tone === "warn"
      ? "text-amber-600"
      : "text-gray-900";
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-xl font-extrabold tabular-nums ${color}`}>
        {value}{" "}
        {unit && <span className="text-xs font-semibold text-gray-400">{unit}</span>}
      </p>
      {sub && <p className="text-xs text-gray-500">{sub}</p>}
      {hint && <p className="mt-0.5 text-[11px] text-amber-600">{hint}</p>}
    </div>
  );
}
