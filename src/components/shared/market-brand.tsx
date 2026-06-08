import { cn } from "@/lib/utils";

interface MarketLogoProps {
  className?: string;
  variant?: "blue" | "green";
}

export function MarketLogo({
  className,
  variant = "green",
}: MarketLogoProps) {
  return (
    <div
      className={cn(
        "flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-[#dfe5f4]",
        className,
      )}
    >
      <img
        alt="Official Culasi seal"
        className="h-full w-full scale-125 rounded-full object-cover mix-blend-multiply"
        src="/culasi-seal.png"
      />
    </div>
  );
}

export function MarketBrandHeader({ className }: { className?: string }) {
  return (
    <div className={cn("text-center", className)}>
      <MarketLogo className="mx-auto" variant="blue" />
      <h1 className="mt-4 font-sans text-2xl font-bold leading-tight text-[#2045b8] sm:text-3xl">
        Culasi Public Market Management System
      </h1>
      <p className="mt-2 text-sm text-slate-600 sm:text-base">
        Culasi City Government - Public Market Division
      </p>
    </div>
  );
}
