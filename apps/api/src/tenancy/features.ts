import type { OrganizationSettings } from "@prisma/client";
import { Permission } from "./permissions";

export const defaultSettings = {
  displayName: null,
  accentColor: "#174877",
  directoryEnabled: true,
  quotesEnabled: true,
  ordersEnabled: true,
} as const;

export type Settings = Pick<OrganizationSettings, keyof typeof defaultSettings>;

export function publicSettings(settings: Settings | null): Settings {
  if (!settings) return { ...defaultSettings };
  const { displayName, accentColor, directoryEnabled, quotesEnabled, ordersEnabled } = settings;
  return { displayName, accentColor, directoryEnabled, quotesEnabled, ordersEnabled };
}

const modules: Partial<
  Record<Permission, keyof Pick<Settings, "directoryEnabled" | "quotesEnabled" | "ordersEnabled">>
> = {
  [Permission.DirectoryRead]: "directoryEnabled",
  [Permission.DirectoryWrite]: "directoryEnabled",
  [Permission.QuotesRead]: "quotesEnabled",
  [Permission.QuotesWrite]: "quotesEnabled",
  [Permission.OrdersRead]: "ordersEnabled",
  [Permission.OrdersOperate]: "ordersEnabled",
  [Permission.OrdersWrite]: "ordersEnabled",
  [Permission.OrdersConfigure]: "ordersEnabled",
};

export function enabled(settings: Settings, permission: Permission) {
  const flag = modules[permission];
  return !flag || settings[flag];
}
