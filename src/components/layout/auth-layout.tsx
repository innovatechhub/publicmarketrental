import { Outlet } from "react-router-dom";
import { MarketBrandHeader } from "@/components/shared/market-brand";

export function AuthLayout() {
  return (
    <div className="min-h-screen bg-[#f3f6fb] px-4 py-8 text-slate-900 sm:py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl flex-col items-center">
        <MarketBrandHeader className="mt-2 sm:mt-8" />
        <main className="mt-10 w-full">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
