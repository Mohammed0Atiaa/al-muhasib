import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getMembership } from "@/lib/company";
import { prisma } from "@/lib/prisma";

// 1. البحث عن عميل برقم الهاتف
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    const membership = await getMembership(user.id);
    const companyId = membership.companyId;

    const { searchParams } = new URL(req.url);
    const phone = searchParams.get("phone");

    if (!phone) {
      return NextResponse.json({ customer: null });
    }

    const customer = await prisma.customer.findFirst({
      where: {
        companyId,
        phone: phone.trim(),
      },
    });

    return NextResponse.json({ customer });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 2. إنشاء عميل جديد سريع
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    const membership = await getMembership(user.id);
    const companyId = membership.companyId;

    const { name, phone } = await req.json();

    if (!name) {
      return NextResponse.json({ error: "اسم العميل مطلوب" }, { status: 400 });
    }

    const customer = await prisma.customer.create({
      data: {
        companyId,
        name: name.trim(),
        phone: phone ? phone.trim() : null,
      },
    });

    return NextResponse.json({ customer });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
