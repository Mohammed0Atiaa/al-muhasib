import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMembership } from "@/lib/company";

// 1. جلب قائمة العملاء أو عميل محدد برقم ID
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    const membership = await getMembership(user.id);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (id) {
      const customer = await prisma.customer.findFirst({
        where: { id, companyId: membership.companyId },
      });
      return NextResponse.json({ customer });
    }

    const customers = await prisma.customer.findMany({
      where: { companyId: membership.companyId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ customers });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 2. إنشاء عميل جديد
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    const membership = await getMembership(user.id);
    const body = await request.json();

    if (!body.name || !body.name.trim()) {
      return NextResponse.json(
        { error: "اسم العميل مطلوب" },
        { status: 400 }
      );
    }

    const newCustomer = await prisma.customer.create({
      data: {
        companyId: membership.companyId,
        name: body.name.trim(),
        phone: body.phone || null,
        phone2: body.phone2 || null,
        email: body.email || null,
        address: body.address || null,
        notes: body.notes || null,
      },
    });

    return NextResponse.json({ success: true, customer: newCustomer });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
