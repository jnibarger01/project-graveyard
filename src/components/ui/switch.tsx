import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

export function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "peer inline-flex h-6 w-10 shrink-0 items-center rounded-full bg-elevated shadow-[0_0_0_1px_rgb(255_255_255/0.10)] transition-colors data-[state=checked]:bg-primary",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="block size-5 translate-x-0.5 rounded-full bg-fg transition-transform data-[state=checked]:translate-x-[18px] data-[state=checked]:bg-primary-fg" />
    </SwitchPrimitive.Root>
  );
}
