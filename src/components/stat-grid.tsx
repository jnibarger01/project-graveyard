import type { DashboardStats } from "@/lib/types";
import { WORK_RANGE } from "@/lib/format";

export function StatGrid({ stats }: { stats: DashboardStats }) {
  const items = [
    { label: "Total projects", value: String(stats.total) },
    { label: "Active", value: String(stats.active) },
    { label: "Dormant", value: String(stats.dormant) },
    { label: "Archive candidates", value: String(stats.archived) },
    { label: "Worth resurrecting", value: String(stats.recoverable) },
    { label: "Product opportunities", value: String(stats.potentialProducts) },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl bg-surface px-3 py-3 shadow-[0_0_0_1px_rgb(255_255_255/0.07)]">
          <p className="text-[11px] uppercase tracking-wide text-subtle">{item.label}</p>
          <p className="mt-1 font-serif text-2xl tabular-nums leading-none">{item.value}</p>
        </div>
      ))}
      <div className="col-span-2 rounded-xl bg-surface px-3 py-3 shadow-[0_0_0_1px_rgb(255_255_255/0.07)] sm:col-span-3 lg:col-span-6">
        <p className="text-[11px] uppercase tracking-wide text-subtle">Estimated unfinished workload</p>
        <p className="mt-1 font-serif text-xl">
          {WORK_RANGE[stats.unfinishedWorkload].label}
          <span className="ml-2 text-sm text-muted">
            ~{stats.unfinishedDaysLow}–{stats.unfinishedDaysHigh} focused days if you finished the non-archive set
          </span>
        </p>
      </div>
    </div>
  );
}
