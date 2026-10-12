"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  ChevronDown,
  ChevronUp,
  ListTree,
  Scale,
  TrendingUp,
} from "lucide-react";

const items = [
  { name: "شجرة الحسابات", href: "/reports/chart-of-accounts", icon: ListTree },
  { name: "ميزان المراجعة", href: "/reports/trial-balance", icon: Scale },
  { name: "قائمة الدخل", href: "/reports/income-statement", icon: TrendingUp },
];

export default function ReportsNav() {
  const pathname = usePathname();
  const inReports = pathname.startsWith("/reports");
  const [open, setOpen] = useState(inReports);

  return (
    <div dir="rtl" className="space-y-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm ${
          inReports
            ? "bg-gray-800 text-purple-300"
            : "text-gray-300 hover:bg-gray-800"
        }`}
      >
        <span className="flex items-center gap-3">
          <BarChart3 className="h-5 w-5" />
          <span>التقارير المالية</span>
        </span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {open && (
        <div className="mr-4 space-y-1 border-r border-gray-700 pr-2">
          {items.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs ${
                  active
                    ? "bg-purple-600 font-bold text-white"
                    : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
