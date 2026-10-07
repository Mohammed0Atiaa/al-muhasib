import { prisma } from "./prisma";

export async function getMembership(userId: string) {
  const membership = await prisma.membership.findFirst({ where: { userId } });
  if (!membership) {
    throw new Error("This user does not belong to any company.");
  }
  return membership;
}
