import * as React from "react";
import { cn } from "@/lib/utils";

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "flex min-h-24 w-full rounded-md bg-elevated px-3 py-2 text-sm text-fg shadow-[0_0_0_1px_rgb(255_255_255/0.08)] placeholder:text-subtle outline-none transition-[box-shadow] duration-150 focus-visible:shadow-[0_0_0_1px_rgb(255_255_255/0.22)] disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
