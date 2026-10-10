import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

export async function allocatedByInvoice(
  invoiceIds: string[],
  db: Prisma.TransactionClient = prisma
) {
  const map = new Map<string, number>();
  if (invoiceIds.length === 0) return map;

  const rows = await db.receiptAllocation.findMany({
    where: { invoiceId: { in: invoiceIds }, receipt: { status: "POSTED" } },
    select: { invoiceId: true, amount: true },
  });
  for (const r of rows) {
    map.set(r.invoiceId, (map.get(r.invoiceId) ?? 0) + Number(r.amount));
  }
  return map;
}
