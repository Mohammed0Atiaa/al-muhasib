import { NextResponse } from "next/server";
import { getReportContext } from "@/lib/reports";
import { createPaymentVoucher } from "@/lib/payments-data";

export async function POST(req: Request) {
  try {
    const ctx = await getReportContext();
    if (!ctx.allowed) {
      return NextResponse.json({ error: "غير مصرح لك بإصدار سندات صرف" }, { status: 403 });
    }

    const body = await req.json();
    const {
      debitAccountId,
      creditAccountId,
      amount,
      currency,
      exchangeRate,
      description,
      referenceNumber,
      entryDate,
      branchId,
    } = body;

    if (!debitAccountId || !creditAccountId || !amount || Number(amount) <= 0) {
      return NextResponse.json(
        { error: "يرجى تحديد حساب الصرف، حساب الخزينة/البنك، والمبلغ بشكل صحيح" },
        { status: 400 }
      );
    }

    const result = await createPaymentVoucher({
      companyId: ctx.companyId,
      branchId: branchId || ctx.forcedBranchId || null,
      entryDate: entryDate ? new Date(entryDate) : new Date(),
      debitAccountId,
      creditAccountId,
      amount: Number(amount),
      currency: currency || ctx.baseCurrency,
      exchangeRate: Number(exchangeRate || 1),
      description: description || "سند صرف",
      referenceNumber: referenceNumber || null,
      createdByUserId: ctx.userId,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error("Error creating payment voucher:", error);
    return NextResponse.json(
      { error: error.message || "حدث خطأ أثناء حفظ سند الصرف" },
      { status: 500 }
    );
  }
}
