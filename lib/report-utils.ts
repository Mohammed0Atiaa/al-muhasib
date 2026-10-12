export type Ymd = string;

export function isValidYmd(s: string | null | undefined): s is Ymd {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
  );
}

export function todayInTz(tz: string): Ymd {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
}

export function addDays(ymd: Ymd, n: number): Ymd {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

function tzOffsetMinutes(tz: string, at: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p: Record<string, string> = {};
  for (const part of dtf.formatToParts(at)) p[part.type] = part.value;
  const asUtc = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour),
    Number(p.minute),
    Number(p.second)
  );
  return Math.round((asUtc - at.getTime()) / 60000);
}

// بداية اليوم (12:00 منتصف الليل) بتوقيت المنطقة، كلحظة UTC
export function startOfDayUtc(ymd: Ymd, tz: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  const wall = Date.UTC(y, m - 1, d, 0, 0, 0);
  let instant = wall - tzOffsetMinutes(tz, new Date(wall)) * 60000;
  instant = wall - tzOffsetMinutes(tz, new Date(instant)) * 60000;
  return new Date(instant);
}

export function monthStart(ymd: Ymd): Ymd {
  return ymd.slice(0, 8) + "01";
}

export function yearStart(ymd: Ymd): Ymd {
  return ymd.slice(0, 4) + "-01-01";
}

export function lastMonthRange(ymd: Ymd): { from: Ymd; to: Ymd } {
  const to = addDays(monthStart(ymd), -1);
  return { from: monthStart(to), to };
}

export function fmtNum(n: number, dec: number): string {
  const abs = Math.abs(n);
  const s = abs.toLocaleString("en-US", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });
  return n < 0 && Number(abs.toFixed(dec)) !== 0 ? `(${s})` : s;
}

export function fmtOrDash(n: number, dec: number): string {
  return Math.abs(n) < 0.5 * Math.pow(10, -dec) ? "-" : fmtNum(n, dec);
}

export function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export function qs(params: Record<string, string | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) sp.set(k, v);
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}
