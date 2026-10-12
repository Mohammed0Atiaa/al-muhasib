import { Prisma } from "@prisma/client";
import { getCurrentUser } from "./auth";
import { getMembership } from "./company";
import { prisma } from "./prisma";
import { COUNTRIES } from "./countries";

export const REPORT_ROLES = ["OWNER", "MANAGER", "ACCOUNTANT"];

export type ReportContext = {
  companyId: string;
  companyName: string;
  baseCurrency: string;
  decimals: number;
  tz: string;
  allowed: boolean;
  forcedBranchId: string | null;
  branches: { id: string; name: string }[];
};

export async function getReportContext(): Promise<ReportContext> {
  const user = await getCurrentUser();
  const membership = await getMembership(user.id);
  const company = membership.company;

  const [currency, branches] = await Promise.all([
    prisma.currency.findUnique({ where: { code: company.baseCurrency } }),
    prisma.branch.findMany({
      where: {
        companyId: company.id,
        isActive: true,
        ...(membership.branchId ? { id: membership.branchId } : {}),
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return {
    companyId: company.id,
    companyName: company.name,
    baseCurrency: company.baseCurrency,
    decimals: currency?.decimals ?? 3,
    tz: COUNTRIES[company.country ?? ""]?.tz ?? "UTC",
    allowed: REPORT_ROLES.includes(membership.role),
    forcedBranchId: membership.branchId ?? null,
    branches,
  };
}

export type AccountRow = {
  id: string;
  code: string;
  name: string;
  type: string;
  nature: string;
  parentCode: string | null;
  isGroup: boolean;
};

export async function fetchAccounts(companyId: string): Promise<AccountRow[]> {
  return prisma.account.findMany({
    where: { companyId },
    select: {
      id: true,
      code: true,
      name: true,
      type: true,
      nature: true,
      parentCode: true,
      isGroup: true,
    },
    orderBy: { code: "asc" },
  });
}

// od/oc: مدين/دائن قبل الفترة، pd/pc: مدين/دائن خلال الفترة
export type Tot = { od: number; oc: number; pd: number; pc: number };

export async function fetchTotals(opts: {
  companyId: string;
  from: Date;
  toExclusive: Date;
  branchId?: string | null;
}): Promise<Map<string, Tot>> {
  const fromTs = Prisma.sql`(${opts.from.toISOString()}::timestamptz AT TIME ZONE 'UTC')`;
  const toTs = Prisma.sql`(${opts.toExclusive.toISOString()}::timestamptz AT TIME ZONE 'UTC')`;
  const branchSql = opts.branchId
    ? Prisma.sql`AND e."branchId" = ${opts.branchId}`
    : Prisma.empty;

  const rows = await prisma.$queryRaw<
    {
      accountId: string;
      od: Prisma.Decimal;
      oc: Prisma.Decimal;
      pd: Prisma.Decimal;
      pc: Prisma.Decimal;
    }[]
  >(Prisma.sql`
    SELECT l."accountId" AS "accountId",
      COALESCE(SUM(l."debit")  FILTER (WHERE e."entryDate" <  ${fromTs}), 0) AS "od",
      COALESCE(SUM(l."credit") FILTER (WHERE e."entryDate" <  ${fromTs}), 0) AS "oc",
      COALESCE(SUM(l."debit")  FILTER (WHERE e."entryDate" >= ${fromTs}), 0) AS "pd",
      COALESCE(SUM(l."credit") FILTER (WHERE e."entryDate" >= ${fromTs}), 0) AS "pc"
    FROM "JournalLine" l
    JOIN "JournalEntry" e ON e."id" = l."entryId"
    WHERE e."companyId" = ${opts.companyId}
      AND e."entryDate" < ${toTs}
      ${branchSql}
    GROUP BY l."accountId"
  `);

  const map = new Map<string, Tot>();
  for (const r of rows) {
    map.set(r.accountId, {
      od: Number(r.od),
      oc: Number(r.oc),
      pd: Number(r.pd),
      pc: Number(r.pc),
    });
  }
  return map;
}

export type TreeNode = AccountRow & {
  level: number;
  tot: Tot;
  hasActivity: boolean;
};

// يجمع أرصدة الحسابات الفرعية داخل المجموعات والفئات الأب
export function buildTree(accounts: AccountRow[], totals: Map<string, Tot>): TreeNode[] {
  const byCode = new Map(accounts.map((a) => [a.code, a]));
  const sums = new Map<string, Tot>();

  for (const a of accounts) {
    const t = totals.get(a.id);
    if (!t) continue;
    const seen = new Set<string>();
    let code: string | null = a.code;
    while (code && !seen.has(code)) {
      seen.add(code);
      const cur = sums.get(code) ?? { od: 0, oc: 0, pd: 0, pc: 0 };
      cur.od += t.od;
      cur.oc += t.oc;
      cur.pd += t.pd;
      cur.pc += t.pc;
      sums.set(code, cur);
      code = byCode.get(code)?.parentCode ?? null;
    }
  }

  const levelOf = (code: string): number => {
    let level = 0;
    const seen = new Set<string>([code]);
    let p: string | null = byCode.get(code)?.parentCode ?? null;
    while (p && byCode.has(p) && !seen.has(p)) {
      seen.add(p);
      level += 1;
      p = byCode.get(p)?.parentCode ?? null;
    }
    return level;
  };

  return [...accounts]
    .sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0))
    .map((a) => {
      const tot = sums.get(a.code) ?? { od: 0, oc: 0, pd: 0, pc: 0 };
      return {
        ...a,
        level: levelOf(a.code),
        tot,
        hasActivity: tot.od !== 0 || tot.oc !== 0 || tot.pd !== 0 || tot.pc !== 0,
      };
    });
}
