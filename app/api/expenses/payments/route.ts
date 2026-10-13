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
    console.log("=== PAYMENT VOUCHER BODY ===", JSON.stringify(body, null, 2));

    // التقاط الحقول بالأسماء الصحيحة التي تأتي من واجهة المستخدم
    const debitAccountId = body.expenseCategoryId || body.debitAccountId || body.accountId;
    const creditAccountId = body.paymentMethod || body.creditAccountId || body.treasuryAccountId || body.cashAccountId;
    
    const amount = Number(body.amount ?? 0);
    const currency = body.currency || ctx.baseCurrency;
    const exchangeRate = Number(body.exchangeRate ?? 1);
    
    // دمج الملاحظات مع اسم المستفيد لضمان توثيق كامل
    const paidTo = body.paidTo ? `إلى: ${body.paidTo}` : "";
    const userNotes = body.notes || body.description || "";
    const description = [paidTo, userNotes].filter(Boolean).join(" - ") || "سند صرف";
    
    const referenceNumber = body.referenceNumber || body.ref || null;
    const entryDate = body.entryDate || body.date || new Date();
    const branchId = body.branchId;

    if (!debitAccountId) {
      return NextResponse.json({ error: "يرجى اختيار فئة أو حساب المصروف" }, { status: 400 });
    }
    if (!creditAccountId) {
      return NextResponse.json({ error: "يرجى اختيار طريقة الدفع أو حساب الخزينة/البنك" }, { status: 400 });
    }
    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "يرجى إدخال مبلغ صحيح أكبر من الصفر" }, { status: 400 });
    }

    const result = await createPaymentVoucher({
      companyId: ctx.companyId,
      branchId: branchId || ctx.forcedBranchId || null,
      entryDate: new Date(entryDate),
      debitAccountId,
      creditAccountId,
      amount,
      currency,
      exchangeRate,
      description,
      referenceNumber,
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
