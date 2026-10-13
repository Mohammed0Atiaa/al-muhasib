"use client";

import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type ChartPoint = { label: string; revenue: number; expense: number; net: number };
type SalesPoint = { label: string; total: number };

const fmt = (v: number, dec: number) =>
  v.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });

const compact = (v: number) =>
  new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(v);

function ChartTooltip({
  active,
  payload,
  label,
  dec,
  cur,
}: {
  active?: boolean;
  payload?: any[];
  label?: string | number;
  dec: number;
  cur: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div dir="rtl" className="rounded-lg border bg-white p-2 text-xs shadow-lg">
      <p className="mb-1 font-bold text-gray-700">{label}</p>
      {payload.map((p: any) => (
        <p key={String(p.dataKey)} style={{ color: p.color ?? p.fill }}>
          {p.name}: {fmt(Number(p.value), dec)} {cur}
        </p>
      ))}
    </div>
  );
}

export function RevenueExpenseChart({
  data,
  decimals,
  currency,
}: {
  data: ChartPoint[];
  decimals: number;
  currency: string;
}) {
  const empty = data.every((d) => d.revenue === 0 && d.expense === 0);
  if (empty) {
    return (
      <div className="flex h-72 items-center justify-center text-sm text-gray-400">
        لا توجد حركات إيرادات أو مصروفات في هذه الفترة
      </div>
    );
  }

  return (
    <div dir="ltr" className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11 }}
            interval="preserveStartEnd"
            minTickGap={16}
          />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => compact(v)} width={48} />
          <Tooltip
            content={(props: any) => <ChartTooltip {...props} dec={decimals} cur={currency} />}
          />
          <Legend />
          <Bar dataKey="revenue" name="الإيرادات" fill="#16a34a" radius={[4, 4, 0, 0]} />
          <Bar dataKey="expense" name="المصروفات" fill="#dc2626" radius={[4, 4, 0, 0]} />
          <Line
            type="monotone"
            dataKey="net"
            name="صافي الربح"
            stroke="#7c3aed"
            strokeWidth={2}
            dot={data.length <= 31}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Sparkline({
  data,
  decimals,
  currency,
}: {
  data: SalesPoint[];
  decimals: number;
  currency: string;
}) {
  if (data.length < 2 || data.every((d) => d.total === 0)) return null;

  return (
    <div dir="ltr" className="h-16 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <Tooltip
            content={(props: any) => <ChartTooltip {...props} dec={decimals} cur={currency} />}
          />
          <Area
            type="monotone"
            dataKey="total"
            name="المبيعات"
            stroke="#7c3aed"
            fill="#ede9fe"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
