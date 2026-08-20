import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium tracking-wide uppercase",
  {
    variants: {
      tone: {
        neutral: "bg-elevated text-muted",
        finish: "bg-moss/15 text-moss",
        archive: "bg-fg/8 text-muted",
        merge: "bg-accent/10 text-accent",
        oss: "bg-primary/10 text-primary",
        product: "bg-warn/15 text-warn",
        high: "bg-moss/15 text-moss",
        mid: "bg-warn/15 text-warn",
        low: "bg-rust/15 text-rust",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export function Badge({
  className,
  tone,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

export { badgeVariants };
