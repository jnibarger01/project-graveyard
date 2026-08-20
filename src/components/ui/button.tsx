import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[background-color,box-shadow,color,transform,opacity] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:not-disabled:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-fg hover:bg-primary/90",
        secondary:
          "bg-elevated text-fg shadow-[0_0_0_1px_rgb(255_255_255/0.08)] hover:shadow-[0_0_0_1px_rgb(255_255_255/0.14)]",
        ghost: "text-fg hover:bg-elevated",
        outline:
          "bg-transparent text-fg shadow-[0_0_0_1px_rgb(255_255_255/0.10)] hover:bg-elevated",
        destructive: "bg-rust/15 text-rust hover:bg-rust/25",
        moss: "bg-moss/15 text-moss hover:bg-moss/25",
        link: "text-muted underline-offset-4 hover:text-fg hover:underline",
      },
      size: {
        default: "h-10 px-3.5",
        sm: "h-8 rounded-sm px-2.5 text-xs",
        lg: "h-11 rounded-lg px-5",
        icon: "size-10",
        "icon-sm": "size-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { buttonVariants };
