import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getMembership } from "@/lib/company";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "غير مصرح بالدخول" }, { status: 401 });
    }

    const { companyId } = await getMembership(user.id);
    const body = await req.json();

    const { paidTo, expenseCategoryId, amount, paymentMethod, notes } = body;

    if (!paidTo || !amount || amount <= 0) {
      return NextResponse.json(
        { error: "بيانات السند غير مكتملة" },
        { status: 400 }
      );
    }

    // إنشاء رقم مسلسل جديد لسند الصرف (مثال: PV-0001)
    const count = await prisma.paymentVoucher.count({
      where: { companyId },
    });
    const voucherNumber = `PV-${(count + 1).toString().padStart(4, "0")}`;

    // حفظ سند الصرف في قاعدة البيانات
    const voucher = await prisma.paymentVoucher.create({
      data: {
        companyId,
        userId: user.id,
        number: voucherNumber,
        paidTo,
        expenseCategoryId,
        amount: parseFloat(amount),
        method: paymentMethod || "CASH",
        notes: notes || "",
      },
    });

    return NextResponse.json({ id: voucher.id, number: voucher.number });
  } catch (error: any) {
    console.error("Payment Voucher Creation Error:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء حفظ سند الصرف في قاعدة البيانات" },
      { status: 500 }
    );
  }
}
