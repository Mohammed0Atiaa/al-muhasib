"use server";

import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireMember } from "../company";

const ProductSchema = z.object({
  name: z.string().trim().min(1, "اسم الصنف مطلوب").max(150),
  price: z.coerce.number().nonnegative("السعر لا يمكن أن يكون سالبًا"),
  costPrice: z.coerce.number().nonnegative("التكلفة لا يمكن أن تكون سالبة").optional(),
  quantity: z.coerce.number().int("الكمية يجب أن تكون عددًا صحيحًا").min(0, "الكمية لا يمكن أن تكون سالبة"),
  sku: z.string().trim().max(60).optional(),
  lowStockAt: z.coerce.number().int().min(0).optional(),
});

export async function deleteProduct(formData: FormData) {
  const { user, companyId } = await requireMember("inventory:manage");
  const id = String(formData.get("id") || "");
  if (!id) throw new Error("معرّف الصنف غير موجود");

  const product = await prisma.product.findFirst({
    where: { id, companyId },
    select: { id: true, name: true },
  });
  if (!product) throw new Error("الصنف غير موجود");

  // لا يُحذف صنف استُخدم في فواتير (حتى لا تتعطل الفواتير والإلغاء لاحقًا)
  const usedInInvoices = await prisma.invoiceItem.count({ where: { productId: id } });
  if (usedInInvoices > 0) {
    throw new Error("لا يمكن حذف صنف مستخدم في فواتير");
  }

  // ولا يُحذف صنف له رصيد في أي مخزن
  const stock = await prisma.warehouseStock.aggregate({
    where: { productId: id },
    _sum: { quantity: true },
  });
  if ((stock._sum.quantity ?? 0) > 0) {
    throw new Error("لا يمكن حذف صنف له رصيد في المخزن");
  }

  await prisma.$transaction(async (tx) => {
    await tx.product.deleteMany({ where: { id, companyId } });
    await tx.auditLog.create({
      data: {
        companyId,
        userId: user.id,
        action: "PRODUCT_DELETED",
        entityType: "Product",
        entityId: id,
        reason: product.name,
      },
    });
  });
}

export async function createProduct(formData: FormData) {
  const { user, membership } = await requireMember("inventory:manage");

  const parsed = ProductSchema.safeParse({
    name: formData.get("name"),
    price: formData.get("price"),
    costPrice: formData.get("costPrice") || undefined,
    quantity: formData.get("quantity"),
    sku: formData.get("sku") || undefined,
    lowStockAt: formData.get("lowStockAt") || undefined,
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "بيانات الصنف غير صحيحة");
  }

  const warehouse = await prisma.warehouse.findFirst({
    where: {
      companyId: membership.companyId,
      ...(membership.branchId ? { branchId: membership.branchId } : {}),
    },
    orderBy: { id: "asc" },
  });
  if (!warehouse) {
    throw new Error("لا يوجد مخزن مُعَدّ لهذه الشركة");
  }

  try {
    await prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          name: parsed.data.name,
          price: parsed.data.price,
          costPrice: parsed.data.costPrice,
          quantity: parsed.data.quantity,
          sku: parsed.data.sku,
          lowStockAt: parsed.data.lowStockAt,
          userId: user.id,
          companyId: membership.companyId,
        },
      });
      await tx.warehouseStock.create({
        data: {
          productId: product.id,
          warehouseId: warehouse.id,
          quantity: parsed.data.quantity,
        },
      });
      await tx.auditLog.create({
        data: {
          companyId: membership.companyId,
          userId: user.id,
          action: "PRODUCT_CREATED",
          entityType: "Product",
          entityId: product.id,
          reason: product.name,
        },
      });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error("رمز الصنف (SKU) مستخدم مسبقًا في شركتك");
    }
    console.error(error);
    throw new Error("تعذر إنشاء الصنف");
  }

  redirect("/inventory");
}
