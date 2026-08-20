import { scoreTone } from "@/lib/format";
import { cn } from "@/lib/utils";

export function ScoreRing({
  score,
  size = 52,
  className,
}: {
  score: number;
  size?: number;
  className?: string;
}) {
  const r = 18;
  const c = 2 * Math.PI * r;
  const tone = scoreTone(score);
  const stroke = tone === "high" ? "var(--color-moss)" : tone === "mid" ? "var(--color-warn)" : "var(--color-rust)";
  return (
    <div className={cn("relative inline-flex items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg viewBox="0 0 44 44" className="size-full -rotate-90" aria-hidden>
        <circle cx="22" cy="22" r={r} fill="none" stroke="currentColor" className="text-elevated" strokeWidth="4" />
        <circle
          cx="22"
          cy="22"
          r={r}
          fill="none"
          stroke={stroke}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (score / 100) * c}
        />
      </svg>
      <span className="absolute text-xs font-medium tabular-nums">{Math.round(score)}</span>
    </div>
  );
}
