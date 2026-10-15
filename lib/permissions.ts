// خريطة الصلاحيات المركزية: كل صلاحية بصيغة module:action
// عدّل الأدوار هنا فقط، ولا تكتب فحوص role متفرقة في الكود.

export const ROLES = ["OWNER", "MANAGER", "ACCOUNTANT", "STOREKEEPER", "CASHIER"] as const;
export type Role = (typeof ROLES)[number];

// الأدوار التي يمكن إسنادها للموظفين (OWNER لا يُسند أبدًا من الواجهة)
export const ASSIGNABLE_ROLES = ["MANAGER", "ACCOUNTANT", "STOREKEEPER", "CASHIER"] as const;
// الأدوار التي يحق للمدير (غير المالك) إدارتها وتعيينها
export const MANAGER_MANAGEABLE_ROLES = ["ACCOUNTANT", "STOREKEEPER", "CASHIER"] as const;

const PERMISSIONS: Record<Role, string[]> = {
  OWNER: ["*"],
  MANAGER: [
    "sales:*",
    "receipts:*",
    "payments:*",
    "customers:*",
    "inventory:*",
    "reports:view",
    "team:*",
  ],
  ACCOUNTANT: [
    "sales:view",
    "receipts:view",
    "receipts:create",
    "payments:view",
    "payments:create",
    "customers:view",
    "customers:create",
    "customers:update",
    "inventory:view",
    "reports:view",
  ],
  STOREKEEPER: ["inventory:*", "sales:view", "customers:view"],
  CASHIER: [
    "sales:view",
    "sales:create",
    "receipts:view",
    "receipts:create",
    "customers:view",
    "customers:create",
    "customers:update",
    "inventory:view",
  ],
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function can(role: string, permission: string): boolean {
  if (!isRole(role)) return false;
  const [module] = permission.split(":");
  return PERMISSIONS[role].some((p) => p === "*" || p === permission || p === `${module}:*`);
}
