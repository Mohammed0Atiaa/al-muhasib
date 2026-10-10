import { redirect } from "next/navigation";
import { prisma } from "./prisma";

export async function getMembership(userId: string) {
  const membership = await prisma.membership.findFirst({
    where: { userId },
    include: { company: true },
  });

  if (!membership) {
    const admin = await prisma.platformAdmin.findUnique({ where: { userId } });
    if (admin) redirect("/admin");
    throw new Error("This user does not belong to any company.");
  }
  if (membership.company.status !== "ACTIVE") redirect("/suspended");
  return membership;
}
