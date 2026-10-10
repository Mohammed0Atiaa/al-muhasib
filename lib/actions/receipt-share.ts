"use server";

import { getCurrentUser } from "../auth";
import { getMembership } from "../company";
import { loadReceiptSheet } from "../receipt-data";

function normalizePhone(p?: string | null) {
  let d = (p ?? "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 8) d = "965" + d;
  if (d.length === 11 && d.startsWith("01")) d = "20" + d.slice(1);
  return d;
}

export async function getReceiptWhatsappLink(
  receiptId: string
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  try {
    const user = await getCurrentUser();
    const { companyId } = await getMembership(user.id);
    const d = await loadReceiptSheet({ id: receiptId, companyId });
    if (!d) return { ok: false, error: "السند غير موجود" };

    const f = (n: number) => n.toFixed(d.decimals);
    const lines = [
      d.companyName,
      `سند قبض رقم ${d.number}`,
      `استلمنا من: ${d.customerName}`,
      `المبلغ: ${f(d.amount)} ${d.currency}`,
      d.customerBalance > 0
        ? `المتبقي عليكم: ${f(d.customerBalance)} ${d.currency}`
        : "",
      "شكراً لتعاملكم معنا",
    ].filter(Boolean);
    const text = encodeURIComponent(lines.join("\n"));
    const phone = normalizePhone(d.customerPhone);
    const url = phone
      ? `https://wa.me/${phone}?text=${text}`
      : `https://wa.me/?text=${text}`;
    return { ok: true, url };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "تعذر إنشاء رابط الواتساب" };
  }
}
