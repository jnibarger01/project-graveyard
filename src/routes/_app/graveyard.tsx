import { createFileRoute } from "@tanstack/react-router";
import { Tombstone } from "@/components/tombstone";
import { applyFilters, graveyardList } from "@/lib/stats";
import { useGraveyard } from "@/lib/store";

export const Route = createFileRoute("/_app/graveyard")({
  component: GraveyardPage,
});

function GraveyardPage() {
  const repos = useGraveyard((s) => s.repos);
  const filters = useGraveyard((s) => s.filters);
  const humor = useGraveyard((s) => s.settings.humorEnabled);
  const visible = applyFilters(graveyardList(repos), { ...filters, activity: "all", recommendation: filters.recommendation });

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-subtle">Plots</p>
        <h1 className="mt-1 font-serif text-4xl tracking-tight">The graveyard</h1>
        <p className="mt-2 max-w-xl text-sm text-muted">
          Projects that look safe to archive. Humor is optional — turn epitaphs off in settings if you want a dry
          review.
        </p>
      </header>
      {visible.length === 0 ? (
        <p className="text-sm text-muted">Nothing here. Either everything is alive, or your filters hid the plots.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((r) => (
            <Tombstone key={r.id} repo={r} humor={humor} />
          ))}
        </div>
      )}
    </div>
  );
}
