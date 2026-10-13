import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { fetchAccounts, fetchTotals, type ReportContext } from "./reports";
import { addDays, startOfDayUtc, type Ymd } from "./report-utils";

const n = (v: unknown): number => Number(v ?? 0);
const ts = (d: Date) => Prisma.sql`(${d.toISOString()}::timestamptz AT TIME ZONE 'UTC')`;

export type ChartPoint = { label: string; revenue: number; expense: number; net: number };
export type SalesPoint = { label: string; total: number };

export type RecentItem = {
  kind: "INVOICE" | "RECEIPT" | "PAYMENT";
  id: string;
  title: string;
  party: string;
  amount: number;
  voided: boolean;
  at: number;
  atLabel: string;
  href: string;
};

export type FinanceData = {
  revenue: number;
  expenses: number;
  cogs: number;
  opex: number;
  net: number;
  paymentCount: number;
  cashTotal: number;
  cashLines: { code: string; name: string; balance: number }[];
  receivables: number;
  chart: ChartPoint[];
};

export type DashboardData = {
  inventory: {
    products: number;
    units: number;
    costValue: number;
    retailValue: number;
    lowStock: number;
    outOfStock: number;
    noCost: number;
  };
  sales: {
    total: number;
    count: number;
    avg: number;
    openCredit: number;
    series: SalesPoint[];
  };
  finance: FinanceData | null;
  recent: RecentItem[];
};

type PayRow = {
  id: string;
  sourceId: string | null;
  description: string;
  entryDate: Date;
  amount: unknown;
  voided: boolean;
};

function daysBetween(from: Ymd, to: Ymd): number {
  const a = Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10));
  const b = Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10));
  return Math.round((b - a) / 86400000) + 1;
}

// يومي لو الفترة 62 يوماً أو أقل، وشهري لو أكبر
function buildBuckets(from: Ymd, to: Ymd): { keys: string[]; monthly: boolean } {
  const count = daysBetween(from, to);
  const monthly = count > 62;
  const keys: string[] = [];
  if (!monthly) {
    for (let i = 0; i < count; i++) keys.push(addDays(from, i));
  } else {
    let cur = from.slice(0, 7);
    const end = to.slice(0, 7);
    while (cur <= end) {
      keys.push(cur);
      const [y, m] = cur.split("-").map(Number);
      cur = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
    }
  }
  return { keys, monthly };
}

const bucketKey = (day: string, monthly: boolean) => (monthly ? day.slice(0, 7) : day);
const bucketLabel = (key: string, monthly: boolean) => (monthly ? key : key.slice(5));

export async function loadDashboard(opts: {
  ctx: ReportContext;
  from: Ymd;
  to: Ymd;
  branchId: string;
  finance: boolean;
}): Promise<DashboardData> {
  const { ctx, from, to, branchId, finance } = opts;
  const dec = ctx.decimals;
  const round = (x: number) => Number(x.toFixed(dec));
  const eps = 0.5 * Math.pow(10, -dec);

  const fromDate = startOfDayUtc(from, ctx.tz);
  const toExcl = startOfDayUtc(addDays(to, 1), ctx.tz);
  const fromTs = ts(fromDate);
  const toTs = ts(toExcl);

  const iBranch = branchId ? Prisma.sql`AND i."branchId" = ${branchId}` : Prisma.empty;
  const eBranch = branchId ? Prisma.sql`AND e."branchId" = ${branchId}` : Prisma.empty;
  const stockScope = branchId
    ? Prisma.sql`AND s."warehouseId" IN (SELECT w."id" FROM "Warehouse" w WHERE w."branchId" = ${branchId})`
    : Prisma.empty;

  const { keys, monthly } = buildBuckets(from, to);

  // ---------- المخزون (لحظي) ----------
  const inventoryP = prisma.$queryRaw<
    {
      products: number;
      units: unknown;
      costValue: unknown;
      retailValue: unknown;
      lowStock: number;
      outOfStock: number;
      noCost: number;
    }[]
  >(Prisma.sql`
    WITH q AS (
      SELECT p."id" AS "id", p."lowStockAt" AS "low", p."costPrice" AS "cost", p."price" AS "price",
             COALESCE(SUM(s."quantity"), 0) AS "qty"
      FROM "Product" p
      LEFT JOIN "WarehouseStock" s ON s."productId" = p."id" ${stockScope}
      WHERE p."companyId" = ${ctx.companyId}
      GROUP BY p."id"
    )
    SELECT
      COUNT(*)::int AS "products",
      COALESCE(SUM("qty"), 0)::float8 AS "units",
      COALESCE(SUM("qty" * "cost"), 0) AS "costValue",
      COALESCE(SUM("qty" * "price"), 0) AS "retailValue",
      (COUNT(*) FILTER (WHERE "low" IS NOT NULL AND "qty" <= "low"))::int AS "lowStock",
      (COUNT(*) FILTER (WHERE "qty" <= 0))::int AS "outOfStock",
      (COUNT(*) FILTER (WHERE "cost" = 0))::int AS "noCost"
    FROM q
  `);

  // ---------- المبيعات (من الفواتير غير الملغاة، بالعملة الأساسية) ----------
  const salesP = prisma.$queryRaw<{ d: string; total: unknown; cnt: number }[]>(Prisma.sql`
    SELECT to_char(((i."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${ctx.tz}::text), 'YYYY-MM-DD') AS "d",
           COALESCE(SUM(i."total" * i."exchangeRate"), 0) AS "total",
           COUNT(*)::int AS "cnt"
    FROM "Invoice" i
    WHERE i."companyId" = ${ctx.companyId}
      AND i."status" = 'POSTED'
      AND i."createdAt" >= ${fromTs}
      AND i."createdAt" < ${toTs}
      ${iBranch}
    GROUP BY 1
    ORDER BY 1
  `);

  const openCreditP = prisma.$queryRaw<{ c: number }[]>(Prisma.sql`
    SELECT COUNT(*)::int AS "c"
    FROM "Invoice" i
    WHERE i."companyId" = ${ctx.companyId}
      AND i."status" = 'POSTED'
      AND i."balanceDue" > 0
      AND i."balanceDue" > COALESCE((
        SELECT SUM(al."amount")
        FROM "ReceiptAllocation" al
        JOIN "ReceiptVoucher" r ON r."id" = al."receiptId"
        WHERE al."invoiceId" = i."id" AND r."status" = 'POSTED'
      ), 0)
      ${iBranch}
  `);

  // ---------- آخر العمليات ----------
  const invoicesP = prisma.invoice.findMany({
    where: { companyId: ctx.companyId, ...(branchId ? { branchId } : {}) },
    orderBy: { createdAt: "desc" },
    take: 8,
  });
  const receiptsP = prisma.receiptVoucher.findMany({
    where: { companyId: ctx.companyId, ...(branchId ? { branchId } : {}) },
    orderBy: { createdAt: "desc" },
    take: 8,
  });
  const paymentsP: Promise<PayRow[]> = finance
    ? prisma.$queryRaw<PayRow[]>(Prisma.sql`
        SELECT e."id" AS "id", e."sourceId" AS "sourceId", e."description" AS "description",
               e."entryDate" AS "entryDate",
               COALESCE(SUM(l."debit"), 0) AS "amount",
               EXISTS (SELECT 1 FROM "JournalEntry" r WHERE r."reversalOfId" = e."id") AS "voided"
        FROM "JournalEntry" e
        JOIN "JournalLine" l ON l."entryId" = e."id"
        WHERE e."companyId" = ${ctx.companyId}
          AND e."sourceType" = 'PAYMENT'
          ${eBranch}
        GROUP BY e."id"
        ORDER BY e."entryDate" DESC
        LIMIT 8
      `)
    : Promise.resolve([] as PayRow[]);

  // ---------- المالية (للأدوار المصرّح لها فقط) ----------
  const loadFinance = async (): Promise<FinanceData> => {
    const [accounts, totals, daily, payCount] = await Promise.all([
      fetchAccounts(ctx.companyId),
      fetchTotals({
        companyId: ctx.companyId,
        from: fromDate,
        toExclusive: toExcl,
        branchId: branchId || null,
      }),
      prisma.$queryRaw<{ d: string; revenue: unknown; expense: unknown }[]>(Prisma.sql`
        SELECT to_char(((e."entryDate" AT TIME ZONE 'UTC') AT TIME ZONE ${ctx.tz}::text), 'YYYY-MM-DD') AS "d",
               COALESCE(SUM(CASE WHEN a."type" = 'REVENUE' THEN l."credit" - l."debit" ELSE 0 END), 0) AS "revenue",
               COALESCE(SUM(CASE WHEN a."type" = 'EXPENSE' THEN l."debit" - l."credit" ELSE 0 END), 0) AS "expense"
        FROM "JournalLine" l
        JOIN "JournalEntry" e ON e."id" = l."entryId"
        JOIN "Account" a ON a."id" = l."accountId"
        WHERE e."companyId" = ${ctx.companyId}
          AND e."entryDate" >= ${fromTs}
          AND e."entryDate" < ${toTs}
          AND a."type" IN ('REVENUE', 'EXPENSE')
          ${eBranch}
        GROUP BY 1
        ORDER BY 1
      `),
      prisma.$queryRaw<{ c: number }[]>(Prisma.sql`
        SELECT COUNT(*)::int AS "c"
        FROM "JournalEntry" e
        WHERE e."companyId" = ${ctx.companyId}
          AND e."sourceType" = 'PAYMENT'
          AND e."entryDate" >= ${fromTs}
          AND e."entryDate" < ${toTs}
          AND NOT EXISTS (SELECT 1 FROM "JournalEntry" r WHERE r."reversalOfId" = e."id")
          ${eBranch}
      `),
    ]);

    let revenue = 0;
    let expenses = 0;
    let cogs = 0;
    let cashTotal = 0;
    let receivables = 0;
    const cashLines: { code: string; name: string; balance: number }[] = [];

    for (const a of accounts) {
      if (a.isGroup) continue;
      const t = totals.get(a.id);
      if (!t) continue;

      if (a.type === "REVENUE") {
        revenue += t.pc - t.pd;
      } else if (a.type === "EXPENSE") {
        const v = t.pd - t.pc;
        expenses += v;
        if (a.parentCode === "50") cogs += v;
      }

      // الرصيد حتى نهاية الفترة = رصيد أول المدة + حركة الفترة
      const closing = t.od - t.oc + (t.pd - t.pc);
      if (a.parentCode === "10") {
        cashTotal += closing;
        if (Math.abs(closing) > eps) {
          cashLines.push({ code: a.code, name: a.name, balance: round(closing) });
        }
      }
      if (a.code === "1100") receivables = closing;
    }

    const map = new Map(keys.map((k) => [k, { revenue: 0, expense: 0 }]));
    for (const r of daily) {
      const cur = map.get(bucketKey(r.d, monthly));
      if (cur) {
        cur.revenue += n(r.revenue);
        cur.expense += n(r.expense);
      }
    }
    const chart: ChartPoint[] = keys.map((k) => {
      const v = map.get(k)!;
      return {
        label: bucketLabel(k, monthly),
        revenue: round(v.revenue),
        expense: round(v.expense),
        net: round(v.revenue - v.expense),
      };
    });

    return {
      revenue: round(revenue),
      expenses: round(expenses),
      cogs: round(cogs),
      opex: round(expenses - cogs),
      net: round(revenue - expenses),
      paymentCount: payCount[0]?.c ?? 0,
      cashTotal: round(cashTotal),
      cashLines,
      receivables: round(receivables),
      chart,
    };
  };

  const financeP: Promise<FinanceData | null> = finance ? loadFinance() : Promise.resolve(null);

  const [invRows, salesRows, openRows, invoices, receipts, payRows, fin] = await Promise.all([
    inventoryP,
    salesP,
    openCreditP,
    invoicesP,
    receiptsP,
    paymentsP,
    financeP,
  ]);

  // ---------- تجميع النتائج ----------
  const inv = invRows[0];
  const inventory = {
    products: inv?.products ?? 0,
    units: n(inv?.units),
    costValue: round(n(inv?.costValue)),
    retailValue: round(n(inv?.retailValue)),
    lowStock: inv?.lowStock ?? 0,
    outOfStock: inv?.outOfStock ?? 0,
    noCost: inv?.noCost ?? 0,
  };

  const salesMap = new Map(keys.map((k) => [k, 0]));
  let salesTotal = 0;
  let salesCount = 0;
  for (const r of salesRows) {
    const k = bucketKey(r.d, monthly);
    if (salesMap.has(k)) salesMap.set(k, (salesMap.get(k) ?? 0) + n(r.total));
    salesTotal += n(r.total);
    salesCount += r.cnt;
  }
  const sales = {
    total: round(salesTotal),
    count: salesCount,
    avg: salesCount > 0 ? round(salesTotal / salesCount) : 0,
    openCredit: openRows[0]?.c ?? 0,
    series: keys.map((k) => ({
      label: bucketLabel(k, monthly),
      total: round(salesMap.get(k) ?? 0),
    })),
  };

  const customerIds = [
    ...new Set(
      [...invoices.map((i) => i.customerId), ...receipts.map((r) => r.customerId)].filter(
        (x): x is string => !!x
      )
    ),
  ];
  const customers = customerIds.length
    ? await prisma.customer.findMany({
        where: { id: { in: customerIds } },
        select: { id: true, name: true },
      })
    : [];
  const names = new Map(customers.map((c) => [c.id, c.name]));
  const label = (d: Date) =>
    d.toLocaleString("en-GB", { timeZone: ctx.tz, dateStyle: "short", timeStyle: "short" });

  const recent: RecentItem[] = [
    ...invoices.map(
      (i): RecentItem => ({
        kind: "INVOICE",
        id: i.id,
        title: `فاتورة ${i.number}`,
        party: i.customerId ? names.get(i.customerId) ?? "-" : "نقدي",
        amount: round(Number(i.total) * Number(i.exchangeRate)),
        voided: i.status === "VOIDED",
        at: i.createdAt.getTime(),
        atLabel: label(i.createdAt),
        href: `/sales/${i.id}`,
      })
    ),
    ...receipts.map(
      (r): RecentItem => ({
        kind: "RECEIPT",
        id: r.id,
        title: `سند قبض ${r.number}`,
        party: names.get(r.customerId) ?? "-",
        amount: round(Number(r.amount) * Number(r.exchangeRate)),
        voided: r.status === "VOIDED",
        at: r.createdAt.getTime(),
        atLabel: label(r.createdAt),
        href: `/customers/receipts/${r.id}`,
      })
    ),
    ...payRows.map(
      (p): RecentItem => ({
        kind: "PAYMENT",
        id: p.id,
        title: "سند صرف",
        party: p.description,
        amount: round(n(p.amount)),
        voided: !!p.voided,
        at: p.entryDate.getTime(),
        atLabel: label(p.entryDate),
        href: p.sourceId ? `/expenses/payments/${p.sourceId}` : "#",
      })
    ),
  ]
    .sort((a, b) => b.at - a.at)
    .slice(0, 12);

  return { inventory, sales, finance: fin, recent };
}
