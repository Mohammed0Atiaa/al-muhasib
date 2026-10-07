"use client";

import { useState } from "react";
import { UserButton } from "@stackframe/stack";
import {
  BarChart3,
  Package,
  Plus,
  Receipt,
  Settings,
  ShoppingCart,
  Users,
  UserPlus,
  ChevronDown,
  ChevronUp,
  ArrowDownLeft,
  ArrowUpRight,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";

export default function Sidebar({
  currentPath = "/dashboard",
}: {
  currentPath: string;
}) {
  // فتح القوائم تلقائياً إذا كان المسار الحالي يتبع لأحد الأقسام
  const [isSalesOpen, setIsSalesOpen] = useState(
    currentPath.startsWith("/sales") || currentPath.startsWith("/payments")
  );
  const [isCustomersOpen, setIsCustomersOpen] = useState(
    currentPath.startsWith("/customers")
  );

  return (
    <div className="fixed left-0 top-0 bg-gray-900 text-white w-64 min-h-screen p-6 z-10" dir="rtl">
      <div className="mb-8">
        <div className="flex items-center space-x-2 space-x-reverse mb-4">
          <BarChart3 className="w-7 h-7 text-purple-500" />
          <span className="text-lg font-semibold">نظام المبيعات والمخزون</span>
        </div>
      </div>

      <nav className="space-y-1 text-right">
        <div className="text-xs font-semibold text-gray-400 uppercase mb-2">
          القائمة الرئيسية
        </div>

        {/* لوحة التحكم */}
        <Link
          href="/dashboard"
          className={`flex items-center space-x-3 space-x-reverse py-2 px-3 rounded-lg text-sm ${
            currentPath === "/dashboard"
              ? "bg-purple-600 text-white font-semibold"
              : "hover:bg-gray-800 text-gray-300"
          }`}
        >
          <BarChart3 className="w-5 h-5" />
          <span>لوحة التحكم</span>
        </Link>

        {/* قسم المبيعات القابل للتنسدل */}
        <div>
          <button
            onClick={() => setIsSalesOpen(!isSalesOpen)}
            className={`w-full flex items-center justify-between py-2 px-3 rounded-lg text-sm ${
              currentPath.startsWith("/sales") || currentPath.startsWith("/payments")
                ? "bg-gray-800 text-purple-400 font-semibold"
                : "hover:bg-gray-800 text-gray-300"
            }`}
          >
            <div className="flex items-center space-x-3 space-x-reverse">
              <Receipt className="w-5 h-5" />
              <span>إدارة المبيعات</span>
            </div>
            {isSalesOpen ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>

          {isSalesOpen && (
            <div className="mt-1 mr-4 space-y-1 border-r-2 border-gray-700 pr-3">
              <Link
                href="/sales/new"
                className={`flex items-center space-x-2 space-x-reverse py-1.5 px-3 rounded-md text-xs ${
                  currentPath === "/sales/new"
                    ? "bg-purple-600 text-white font-bold"
                    : "text-gray-400 hover:text-white hover:bg-gray-800"
                }`}
              >
                <ShoppingCart className="w-4 h-4 text-green-400" />
                <span>فاتورة جديدة</span>
              </Link>

              <Link
                href="/sales"
                className={`flex items-center space-x-2 space-x-reverse py-1.5 px-3 rounded-md text-xs ${
                  currentPath === "/sales"
                    ? "bg-purple-600 text-white font-bold"
                    : "text-gray-400 hover:text-white hover:bg-gray-800"
                }`}
              >
                <Receipt className="w-4 h-4 text-blue-400" />
                <span>سجل الفواتير</span>
              </Link>

              <Link
                href="/payments/receipt"
                className={`flex items-center space-x-2 space-x-reverse py-1.5 px-3 rounded-md text-xs ${
                  currentPath === "/payments/receipt"
                    ? "bg-purple-600 text-white font-bold"
                    : "text-gray-400 hover:text-white hover:bg-gray-800"
                }`}
              >
                <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
                <span>سند قبض</span>
              </Link>

              <Link
                href="/payments/voucher"
                className={`flex items-center space-x-2 space-x-reverse py-1.5 px-3 rounded-md text-xs ${
                  currentPath === "/payments/voucher"
                    ? "bg-purple-600 text-white font-bold"
                    : "text-gray-400 hover:text-white hover:bg-gray-800"
                }`}
              >
                <ArrowUpRight className="w-4 h-4 text-amber-400" />
                <span>سند صرف</span>
              </Link>

              <Link
                href="/sales/return"
                className={`flex items-center space-x-2 space-x-reverse py-1.5 px-3 rounded-md text-xs ${
                  currentPath === "/sales/return"
                    ? "bg-purple-600 text-white font-bold"
                    : "text-gray-400 hover:text-white hover:bg-gray-800"
                }`}
              >
                <RotateCcw className="w-4 h-4 text-red-400" />
                <span>فاتورة مرتجع</span>
              </Link>
            </div>
          )}
        </div>

        {/* قسم العملاء القابل للتنسدل */}
        <div>
          <button
            onClick={() => setIsCustomersOpen(!isCustomersOpen)}
            className={`w-full flex items-center justify-between py-2 px-3 rounded-lg text-sm ${
              currentPath.startsWith("/customers")
                ? "bg-gray-800 text-purple-400 font-semibold"
                : "hover:bg-gray-800 text-gray-300"
            }`}
          >
            <div className="flex items-center space-x-3 space-x-reverse">
              <Users className="w-5 h-5" />
              <span>إدارة العملاء</span>
            </div>
            {isCustomersOpen ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>

          {isCustomersOpen && (
            <div className="mt-1 mr-4 space-y-1 border-r-2 border-gray-700 pr-3">
              <Link
                href="/customers"
                className={`flex items-center space-x-2 space-x-reverse py-1.5 px-3 rounded-md text-xs ${
                  currentPath === "/customers"
                    ? "bg-purple-600 text-white font-bold"
                    : "text-gray-400 hover:text-white hover:bg-gray-800"
                }`}
              >
                <Users className="w-4 h-4" />
                <span>قائمة العملاء</span>
              </Link>

              <Link
                href="/customers/new"
                className={`flex items-center space-x-2 space-x-reverse py-1.5 px-3 rounded-md text-xs ${
                  currentPath === "/customers/new"
                    ? "bg-purple-600 text-white font-bold"
                    : "text-gray-400 hover:text-white hover:bg-gray-800"
                }`}
              >
                <UserPlus className="w-4 h-4" />
                <span>إنشاء عميل جديد</span>
              </Link>
            </div>
          )}
        </div>

        {/* المخزون */}
        <Link
          href="/inventory"
          className={`flex items-center space-x-3 space-x-reverse py-2 px-3 rounded-lg text-sm ${
            currentPath === "/inventory"
              ? "bg-purple-600 text-white font-semibold"
              : "hover:bg-gray-800 text-gray-300"
          }`}
        >
          <Package className="w-5 h-5" />
          <span>المخزون</span>
        </Link>

        {/* إضافة منتج */}
        <Link
          href="/add-product"
          className={`flex items-center space-x-3 space-x-reverse py-2 px-3 rounded-lg text-sm ${
            currentPath === "/add-product"
              ? "bg-purple-600 text-white font-semibold"
              : "hover:bg-gray-800 text-gray-300"
          }`}
        >
          <Plus className="w-5 h-5" />
          <span>إضافة منتج</span>
        </Link>

        {/* الإعدادات */}
        <Link
          href="/settings"
          className={`flex items-center space-x-3 space-x-reverse py-2 px-3 rounded-lg text-sm ${
            currentPath === "/settings"
              ? "bg-purple-600 text-white font-semibold"
              : "hover:bg-gray-800 text-gray-300"
          }`}
        >
          <Settings className="w-5 h-5" />
          <span>الإعدادات</span>
        </Link>
      </nav>

      <div className="absolute bottom-0 left-0 right-0 p-6 border-t border-gray-700">
        <div className="flex items-center justify-between">
          <UserButton showUserInfo />
        </div>
      </div>
    </div>
  );
}
