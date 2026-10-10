import { redirect } from "next/navigation";
import { getCurrentUser } from "./auth";
import { prisma } from "./prisma";

export const MAX_COMPANIES = 5;

export async function isPlatformAdmin(userId: string) {
  const row = await prisma.platformAdmin.findUnique({ where: { userId } });
  return !!row;
}

export async function requirePlatformAdmin() {
  const user = await getCurrentUser();
  if (!(await isPlatformAdmin(user.id))) redirect("/");
  return user;
}
