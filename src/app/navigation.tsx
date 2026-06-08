import {
  BarChart2,
  Bell,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  Map,
  Receipt,
  Settings,
  ShieldAlert,
  Store,
  UserCircle2,
  UserCog,
  Users,
  WalletCards,
} from "lucide-react";
import type { NavItem } from "@/types/domain";

export const adminNavigation: NavItem[] = [
  { label: "Overview", to: "/admin/dashboard", icon: LayoutDashboard, roles: ["super_admin", "admin", "finance"] },
  { label: "Stall Map", to: "/admin/stalls", icon: Store, roles: ["super_admin", "admin"] },
  { label: "Vendors", to: "/admin/vendors", icon: Users, roles: ["super_admin", "admin"] },
  { label: "Payments", to: "/admin/payments", icon: Receipt, roles: ["super_admin", "admin", "finance"] },
  { label: "Reports", to: "/admin/reports", icon: BarChart2, roles: ["super_admin", "admin", "finance"] },
  { label: "Applications", to: "/admin/applications", icon: FileText, roles: ["super_admin", "admin"] },
  { label: "Assignments", to: "/admin/assignments", icon: Map, roles: ["super_admin", "admin"] },
  { label: "Leases", to: "/admin/leases", icon: ClipboardCheck, roles: ["super_admin", "admin"] },
  { label: "Billing", to: "/admin/billing", icon: WalletCards, roles: ["super_admin", "admin", "finance"] },
  { label: "Violations", to: "/admin/violations", icon: ShieldAlert, roles: ["super_admin", "admin"] },
  { label: "Notifications", to: "/admin/notifications", icon: Bell, roles: ["super_admin", "admin", "finance"] },
  { label: "Staff", to: "/admin/staff", icon: UserCog, roles: ["super_admin"] },
  { label: "Settings", to: "/admin/settings", icon: Settings, roles: ["super_admin", "admin"] },
];

export const vendorNavigation: NavItem[] = [
  { label: "Dashboard", to: "/vendor/dashboard", icon: LayoutDashboard },
  { label: "Profile", to: "/vendor/profile", icon: UserCircle2 },
  { label: "Applications", to: "/vendor/applications", icon: FileText },
  { label: "Assigned Stall", to: "/vendor/stall", icon: Store },
  { label: "Billing", to: "/vendor/billing", icon: WalletCards },
  { label: "Notifications", to: "/vendor/notifications", icon: Bell },
];
