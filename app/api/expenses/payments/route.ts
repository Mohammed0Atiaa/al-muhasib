import { NextResponse } from "next/server";
import { z } from "zod";
import { requireMember } from "@/lib/company";
import { apiError } from "@/lib/api-errors";
import {
  createPaymentVoucher,
  EXPENSE_CATEGORY_KEYS,
  PAYMENT_METHOD_ACCOUNTS,
} from "@/lib/payments-data";

const METHOD_KEYS = Object.keys(PAYMENT_METHOD_ACCOUNTS) as [
  keyof typeof PAYMENT_METHOD_ACCOUNTS,
  ...(keyof typeof PAYMENT_METHOD_ACCOUNTS)[],
];

const BodySchema = z.object({
  paidTo: z.string().trim().min(2, "اسم المستفيد مطلوب").max(120),
  expenseCategoryId: z.enum(EXPENSE_CATEGORY_KEYS, { message: "بند المصروف غير صحيح" }),
  paymentMethod: z.enum(METHOD_KEYS, { message: "طريقة الدفع غير صحيحة" }),
  amount: z.coerce.number({ message: "المبلغ غير صحيح" }).positive("يرجى إدخال مبلغ صحيح أكبر من الصفر"),
  notes: z.string().trim().max(500).optional(),
  branchId: z.string().min(1).optional(),
  currency: z.string().length(3).optional(),
});

export async function POST(req: Request) {
  try {
    const { user, membership, companyId } = await requireMember("payments:create");
    const body = BodySchema.parse(await req.json());

    const result = await createPaymentVoucher({
      companyId,
      userId: user.id,
      requestedBranchId: body.branchId ?? null,
      forcedBranchId: membership.branchId ?? null,
      category: body.expenseCategoryId,
      method: body.paymentMethod,
      paidTo: body.paidTo,
      amount: body.amount,
      notes: body.notes,
      currency: body.currency,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return apiError(error, "حدث خطأ أثناء حفظ سند الصرف");
  }
}
