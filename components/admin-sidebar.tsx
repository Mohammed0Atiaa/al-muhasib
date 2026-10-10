"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@stackframe/stack";
import { Building2, LayoutDashboard, ShieldCheck } from "lucide-react";

const items = [
  { name: "لوحة التحكم", href: "/admin", icon: LayoutDashboard },
  { name: "الشركات", href: "/admin/companies", icon: Building2 },
];

export default function AdminSidebar() {
  const path = usePathname();
  return (
    <div dir="rtl" className="fixed left-0 top-0 z-10 min-h-screen w-64 bg-gray-900 p-6 text-white">
      <div className="mb-8 flex items-center gap-2">
        <ShieldCheck className="h-7 w-7" />
        <span className="text-lg font-semibold">إدارة المنصة</span>
      </div>
      <nav className="space-y-1">
        {items.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === "/admin"
              ? path === "/admin" || path.startsWith("/admin/sales")
              : path.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 ${
                active ? "bg-purple-100 text-gray-800" : "text-gray-300 hover:bg-gray-800"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-sm">{item.name}</span>
            </Link>
          );
        })}
      </nav>
      <div className="absolute bottom-0 left-0 right-0 p-6">
        <UserButton showUserInfo />
      </div>
    </div>
  );
}
