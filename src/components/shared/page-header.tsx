import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

export function PageHeader({
  action,
  className,
}: PageHeaderProps) {
  if (!action) return null;

  return (
    <div
      className={cn(
        "flex items-center justify-end rounded-[1.75rem] border border-border/70 bg-card/80 px-6 py-4 shadow-soft",
        className,
      )}
    >
      <div className="shrink-0">{action}</div>
    </div>
  );
}
