import { Role } from "@prisma/client";

export const Permission = {
  CompanyRead: "company:read",
  CompanyWrite: "company:write",
  MembersRead: "members:read",
  MembersWrite: "members:write",
  AuditRead: "audit:read",
  DirectoryRead: "directory:read",
  DirectoryWrite: "directory:write",
  QuotesRead: "quotes:read",
  QuotesWrite: "quotes:write",
  OrdersRead: "orders:read",
  OrdersWrite: "orders:write",
  OrdersOperate: "orders:operate",
  OrdersConfigure: "orders:configure",
} as const;

export type Permission = (typeof Permission)[keyof typeof Permission];

const permissions: Record<Role, ReadonlySet<Permission>> = {
  OWNER: new Set(Object.values(Permission)),
  ADMIN: new Set([
    Permission.CompanyRead,
    Permission.CompanyWrite,
    Permission.MembersRead,
    Permission.MembersWrite,
    Permission.AuditRead,
    Permission.DirectoryRead,
    Permission.DirectoryWrite,
    Permission.QuotesRead,
    Permission.QuotesWrite,
    Permission.OrdersRead,
    Permission.OrdersWrite,
    Permission.OrdersOperate,
    Permission.OrdersConfigure,
  ]),
  MANAGER: new Set([
    Permission.CompanyRead,
    Permission.MembersRead,
    Permission.DirectoryRead,
    Permission.DirectoryWrite,
    Permission.QuotesRead,
    Permission.QuotesWrite,
    Permission.OrdersRead,
    Permission.OrdersWrite,
    Permission.OrdersOperate,
  ]),
  OPERATOR: new Set([
    Permission.CompanyRead,
    Permission.DirectoryRead,
    Permission.QuotesRead,
    Permission.OrdersRead,
    Permission.OrdersOperate,
  ]),
};

export function allows(role: Role, permission: Permission) {
  return permissions[role].has(permission);
}
