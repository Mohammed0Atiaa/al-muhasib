import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMembership } from "@/lib/company";

// 1. تعديل بيانات العميل أو تغيير حالة الحظر
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    const membership = await getMembership(user.id);
    const body = await request.json();

    const updatedCustomer = await prisma.customer.updateMany({
      where: {
        id: params.id,
        companyId: membership.companyId,
      },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.phone !== undefined && { phone: body.phone }),
        ...(body.phone2 !== undefined && { phone2: body.phone2 }),
        ...(body.email !== undefined && { email: body.email }),
        ...(body.address !== undefined && { address: body.address }),
        ...(body.notes !== undefined && { notes: body.notes }),
        ...(body.isBlacklisted !== undefined && { isBlacklisted: body.isBlacklisted }),
      },
    });

    return NextResponse.json({ success: true, updatedCustomer });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 2. حذف العميل مع الحفاظ على الفواتير
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    const membership = await getMembership(user.id);

    // فك ربط الفواتير المترابطة مع العميل أولاً لضمان عدم تلف السجلات المالية
    await prisma.invoice.updateMany({
      where: { customerId: params.id },
      data: { customerId: null },
    });

    // حذف العميل
    await prisma.customer.deleteMany({
      where: {
        id: params.id,
        companyId: membership.companyId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
