import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => (
    <input
      className={cn(
        "flex h-11 w-full rounded-md border border-input bg-background px-4 py-2 text-sm text-foreground outline-none transition placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/15",
        className,
      )}
      ref={ref}
      type={type}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export { Input };
