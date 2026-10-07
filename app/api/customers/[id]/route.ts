import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMembership } from "@/lib/company";

// 1. تعديل بيانات العميل أو حظره (PATCH)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    const membership = await getMembership(user.id);
    const resolvedParams = await params;
    const customerId = resolvedParams.id;

    const body = await request.json();

    const existingCustomer = await prisma.customer.findFirst({
      where: {
        id: customerId,
        companyId: membership.companyId,
      },
    });

    if (!existingCustomer) {
      return NextResponse.json(
        { error: "العميل غير موجود أو ليس لديك صلاحية للوصول إليه" },
        { status: 404 }
      );
    }

    const updatedCustomer = await prisma.customer.update({
      where: { id: customerId },
      data: {
        ...(body.name !== undefined && { name: body.name.trim() }),
        ...(body.phone !== undefined && { phone: body.phone || null }),
        ...(body.phone2 !== undefined && { phone2: body.phone2 || null }),
        ...(body.email !== undefined && { email: body.email || null }),
        ...(body.address !== undefined && { address: body.address || null }),
        ...(body.notes !== undefined && { notes: body.notes || null }),
        ...(body.isBlacklisted !== undefined && { isBlacklisted: body.isBlacklisted }),
      },
    });

    return NextResponse.json({ success: true, customer: updatedCustomer });
  } catch (error: any) {
    console.error("Error updating customer:", error);
    return NextResponse.json(
      { error: error.message || "حدث خطأ أثناء تعديل بيانات العميل" },
      { status: 500 }
    );
  }
}

// 2. حذف العميل بأمان (DELETE)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    const membership = await getMembership(user.id);
    const resolvedParams = await params;
    const customerId = resolvedParams.id;

    const customer = await prisma.customer.findFirst({
      where: {
        id: customerId,
        companyId: membership.companyId,
      },
    });

    if (!customer) {
      return NextResponse.json(
        { error: "العميل غير موجود" },
        { status: 404 }
      );
    }

    // فك ربط الفواتير المباشرة قبل الحذف لمنع الأخطاء المالية
    await prisma.invoice.updateMany({
      where: { customerId: customerId },
      data: { customerId: null },
    });

    await prisma.customer.delete({
      where: { id: customerId },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting customer:", error);
    return NextResponse.json(
      { error: error.message || "حدث خطأ أثناء حذف العميل" },
      { status: 500 }
    );
  }
}
