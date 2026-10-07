"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "../auth";
import { prisma } from "../prisma";
import { getMembership } from "../company";
import { z } from "zod";

const ProductSchema = z.object({
  name: z.string().min(1, "Name is required"),
  price: z.coerce.number().nonnegative("Price must be non-negative"),
  costPrice: z.coerce.number().nonnegative().optional(),
  quantity: z.coerce.number().int().min(0, "Quantity must be non-negative"),
  sku: z.string().optional(),
  lowStockAt: z.coerce.number().int().min(0).optional(),
});

export async function deleteProduct(formData: FormData) {
  const user = await getCurrentUser();
  const { companyId } = await getMembership(user.id);
  const id = String(formData.get("id") || "");

  try {
    await prisma.product.deleteMany({ where: { id, companyId } });
  } catch (error) {
    console.error(error);
    throw new Error("Cannot delete a product that is used in invoices.");
  }
}

export async function createProduct(formData: FormData) {
  const user = await getCurrentUser();
  const membership = await getMembership(user.id);

  const parsed = ProductSchema.safeParse({
    name: formData.get("name"),
    price: formData.get("price"),
    costPrice: formData.get("costPrice") || undefined,
    quantity: formData.get("quantity"),
    sku: formData.get("sku") || undefined,
    lowStockAt: formData.get("lowStockAt") || undefined,
  });

  if (!parsed.success) {
    throw new Error("Validation failed");
  }

  const warehouse = await prisma.warehouse.findFirst({
    where: {
      companyId: membership.companyId,
      ...(membership.branchId ? { branchId: membership.branchId } : {}),
    },
    orderBy: { id: "asc" },
  });
  if (!warehouse) {
    throw new Error("No warehouse is set up for this company.");
  }

  try {
    await prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          ...parsed.data,
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
    });
  } catch (error) {
    console.error(error);
    throw new Error("Failed to create product.");
  }

  redirect("/inventory");
}
