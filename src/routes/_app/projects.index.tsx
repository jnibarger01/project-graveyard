import { createFileRoute } from "@tanstack/react-router";
import { FilterBar } from "@/components/filter-bar";
import { ProjectCard } from "@/components/project-card";
import { applyFilters } from "@/lib/stats";
import { useGraveyard } from "@/lib/store";

export const Route = createFileRoute("/_app/projects/")({
  component: ProjectsPage,
});

function ProjectsPage() {
  const repos = useGraveyard((s) => s.repos);
  const filters = useGraveyard((s) => s.filters);
  const list = applyFilters(repos, filters).slice().sort((a, b) => b.analysis.resurrectionScore - a.analysis.resurrectionScore);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-subtle">Inventory</p>
        <h1 className="mt-1 font-serif text-4xl tracking-tight">Projects</h1>
        <p className="mt-2 text-sm text-muted">
          {list.length} of {repos.length} shown. Filter by fate, language, activity, remaining work, or score.
        </p>
      </header>
      <FilterBar repos={repos} />
      {list.length === 0 ? (
        <p className="rounded-xl bg-surface p-8 text-center text-sm text-muted shadow-[0_0_0_1px_rgb(255_255_255/0.07)]">
          No projects match these filters.
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {list.map((r) => (
            <ProjectCard key={r.id} repo={r} />
          ))}
        </div>
      )}
    </div>
  );
}
