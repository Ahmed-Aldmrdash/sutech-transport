import type { LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  /** Key in the "nav" message namespace. */
  label: string;
  icon: LucideIcon;
  /** Only active on an exact match (area home pages). */
  exact?: boolean;
}

export function isActive(pathname: string, item: Pick<NavItem, "href" | "exact">): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
