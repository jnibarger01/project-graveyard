import { cn } from "@/lib/utils";

export function Meter({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: "fact" | "estimate";
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-sm text-muted">{label}</span>
        <span className="text-sm tabular-nums text-fg">
          {Math.round(value)}
          {hint && (
            <span className="ml-1 text-[10px] uppercase tracking-wide text-subtle">
              {hint === "fact" ? "obs" : "est"}
            </span>
          )}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-elevated">
        <div
          className={cn("h-full rounded-full bg-primary/80")}
          style={{ width: `${Math.max(2, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
}
