import { redirect } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/platform";

export default async function AdminHome() {
  await requirePlatformAdmin();
  redirect("/admin/companies");
}
