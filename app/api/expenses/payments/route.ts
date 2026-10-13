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
    
    // طباعة البيانات القادمة من الواجهة في الـ Terminal لتراناها بوضوح
    console.log("=== DEBUG PAYMENT VOUCHER BODY ===", JSON.stringify(body, null, 2));

    // التقاط الحقول باحتمالات أسمائها المختلفة كلياً لضمان عدم فشل الطلب
    const debitAccountId = 
      body.debitAccountId || 
      body.expenseAccountId || 
      body.accountId || 
      body.categoryId || 
      body.toAccountId;

    const creditAccountId = 
      body.creditAccountId || 
      body.treasuryAccountId || 
      body.cashAccountId || 
      body.bankAccountId || 
      body.fromAccountId;

    const amount = Number(body.amount ?? body.total ?? body.value ?? 0);
    const currency = body.currency || ctx.baseCurrency;
    const exchangeRate = Number(body.exchangeRate ?? 1);
    const description = body.description || body.notes || body.memo || "سند صرف";
    const referenceNumber = body.referenceNumber || body.ref || body.number || null;
    const entryDate = body.entryDate || body.date || body.createdAt;
    const branchId = body.branchId;

    if (!debitAccountId) {
      return NextResponse.json(
        { error: `حقل حساب المصروف/المدين غير موجود. البيانات الواصلة: ${Object.keys(body).join(", ")}` }, 
        { status: 400 }
      );
    }
    if (!creditAccountId) {
      return NextResponse.json(
        { error: `حقل الخزينة/البنك/الدائن غير موجود. البيانات الواصلة: ${Object.keys(body).join(", ")}` }, 
        { status: 400 }
      );
    }
    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "المبلغ غير صحيح أو يساوي صفر" }, { status: 400 });
    }

    const result = await createPaymentVoucher({
      companyId: ctx.companyId,
      branchId: branchId || ctx.forcedBranchId || null,
      entryDate: entryDate ? new Date(entryDate) : new Date(),
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
