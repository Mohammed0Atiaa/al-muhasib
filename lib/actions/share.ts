"use server";

import { randomBytes } from "crypto";
import { headers } from "next/headers";
import { getCurrentUser } from "../auth";
import { getMembership } from "../company";
import { prisma } from "../prisma";
import { loadInvoiceSheet } from "../invoice-data";

function normalizePhone(p?: string | null) {
  let d = (p ?? "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 8) d = "965" + d; // أرقام الكويت
  if (d.length === 11 && d.startsWith("01")) d = "20" + d.slice(1); // أرقام مصر
  return d;
}

export async function getWhatsappLink(
  invoiceId: string
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  try {
    const user = await getCurrentUser();
    const { companyId } = await getMembership(user.id);

    const data = await loadInvoiceSheet({ id: invoiceId, companyId });
    if (!data) return { ok: false, error: "الفاتورة غير موجودة" };

    const inv = await prisma.invoice.findFirst({
      where: { id: invoiceId, companyId },
      select: { id: true, shareToken: true },
    });
    if (!inv) return { ok: false, error: "الفاتورة غير موجودة" };

    let token = inv.shareToken;
    if (!token) {
      token = randomBytes(24).toString("base64url");
      await prisma.invoice.update({ where: { id: inv.id }, data: { shareToken: token } });
    }

    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    const proto = h.get("x-forwarded-proto") ?? "https";
    const link = `${proto}://${host}/i/${token}`;

    const f = (n: number) => n.toFixed(data.decimals);
    const lines = [
      `${data.companyName}`,
      `فاتورة رقم ${data.number}`,
      `الإجمالي: ${f(data.total)} ${data.currency}`,
      data.balance > 0 ? `المتبقي: ${f(data.balance)} ${data.currency}` : "",
      `رابط الفاتورة: ${link}`,
    ].filter(Boolean);
    const text = encodeURIComponent(lines.join("\n"));

    const phone = normalizePhone(data.customerPhone);
    const url = phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`;
    return { ok: true, url };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "تعذر إنشاء رابط الواتساب" };
  }
}
