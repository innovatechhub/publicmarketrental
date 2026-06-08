import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { MarketLogo } from "@/components/shared/market-brand";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/auth-context";
import { cn } from "@/lib/utils";
import type { NavItem } from "@/types/domain";

interface PortalLayoutProps {
  navigation: NavItem[];
  portalName: string;
}

export function PortalLayout({ navigation, portalName }: PortalLayoutProps) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const visibleNavigation = navigation.filter(
    (item) => !item.roles || (user ? item.roles.includes(user.role) : true),
  );

  return (
    <div className="min-h-screen bg-[#f3f6fb] text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-[1304px] items-center justify-between gap-4 px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-4">
            <Button
              aria-label="Open navigation"
              className="shrink-0 lg:hidden"
              onClick={() => setOpen(true)}
              size="icon"
              type="button"
              variant="outline"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <MarketLogo className="h-14 w-14 shrink-0 bg-emerald-50" />
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold text-[#00966f]">{portalName}</h1>
              <p className="truncate text-sm text-slate-500">
                Culasi City Government - Public Market Division
              </p>
            </div>
          </div>

          <nav className="hidden items-center gap-1 lg:flex">
            {visibleNavigation.map((item) => (
              <NavLink
                className={({ isActive }) =>
                  cn(
                    "rounded-md px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950",
                    isActive && "bg-emerald-50 text-[#00966f]",
                  )
                }
                key={item.to}
                to={item.to}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="hidden shrink-0 items-center gap-4 sm:flex">
            <div className="text-right">
              <p className="text-sm font-bold text-slate-900">{user?.name ?? "Vendor"}</p>
              <p className="text-xs text-slate-500">Vendor Account</p>
            </div>
            <Button
              className="bg-red-500 px-4 hover:bg-red-600"
              onClick={async () => {
                await signOut();
                navigate("/login");
              }}
              type="button"
            >
              Logout
            </Button>
          </div>
        </div>
      </header>

      {open ? (
        <button
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden"
          onClick={() => setOpen(false)}
          type="button"
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[290px] bg-white p-5 shadow-xl transition-transform lg:hidden",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MarketLogo className="h-11 w-11 bg-emerald-50" />
            <p className="font-bold text-[#00966f]">{portalName}</p>
          </div>
          <Button onClick={() => setOpen(false)} size="icon" type="button" variant="ghost">
            <X className="h-5 w-5" />
          </Button>
        </div>
        <nav className="space-y-1">
          {visibleNavigation.map((item) => (
            <NavLink
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950",
                  isActive && "bg-emerald-50 text-[#00966f]",
                )
              }
              key={item.to}
              onClick={() => setOpen(false)}
              to={item.to}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <Button
          className="mt-6 w-full bg-red-500 hover:bg-red-600"
          onClick={async () => {
            await signOut();
            navigate("/login");
          }}
          type="button"
        >
          Logout
        </Button>
      </aside>

      <main className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}
