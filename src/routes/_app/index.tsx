import { createFileRoute, Link } from "@tanstack/react-router";
import { ProjectCard } from "@/components/project-card";
import { Section } from "@/components/section";
import { StatGrid } from "@/components/stat-grid";
import { applyFilters } from "@/lib/stats";
import {
  computeStats,
  duplicateExperiments,
  easyWins,
  graveyardList,
  mostWorthResurrecting,
  productOpportunities,
} from "@/lib/stats";
import { useGraveyard } from "@/lib/store";

export const Route = createFileRoute("/_app/")({
  component: DashboardPage,
});

function DashboardPage() {
  const repos = useGraveyard((s) => s.repos);
  const filters = useGraveyard((s) => s.filters);
  const visible = filters.q ? applyFilters(repos, { ...filters, recommendation: "all", language: "all", visibility: "all", activity: "all", work: "all", minScore: 0, minProduct: 0 }) : repos;
  const stats = computeStats(visible);
  const resurrect = mostWorthResurrecting(visible);
  const wins = easyWins(visible);
  const products = productOpportunities(visible);
  const dupes = duplicateExperiments(visible);
  const buried = graveyardList(visible).slice(0, 4);

  return (
    <div className="space-y-10">
      <header className="rise-in">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-subtle">Unfinished work, decided</p>
        <h1 className="mt-2 font-serif text-4xl tracking-tight sm:text-5xl">What deserves another weekend?</h1>
        <p className="mt-3 max-w-2xl text-muted">
          A working review of dormant repositories — not a graveyard for its own sake. Finish, merge, productize, or
          bury with intent.
        </p>
      </header>

      <StatGrid stats={stats} />

      <Section title="Most worth resurrecting" kicker="Highest scores" href="/projects">
        <div className="grid gap-3 md:grid-cols-2">
          {resurrect.map((r) => (
            <ProjectCard key={r.id} repo={r} />
          ))}
        </div>
      </Section>

      <Section title="Easy wins" kicker="Small remaining work" href="/projects">
        {wins.length === 0 ? (
          <p className="text-sm text-muted">No small remaining-work projects right now.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {wins.map((r) => (
              <ProjectCard key={r.id} repo={r} />
            ))}
          </div>
        )}
      </Section>

      <Section title="Product opportunities" kicker="Commercial potential" href="/projects">
        {products.length === 0 ? (
          <p className="text-sm text-muted">Nothing currently looks like a product candidate.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {products.map((r) => (
              <ProjectCard key={r.id} repo={r} />
            ))}
          </div>
        )}
      </Section>

      <Section title="Duplicate experiments" kicker="Consider consolidating">
        {dupes.length === 0 ? (
          <p className="text-sm text-muted">No overlapping experiments detected.</p>
        ) : (
          <div className="grid gap-3">
            {dupes.map((r) => {
              const o = r.analysis.overlaps[0];
              return (
                <Link
                  key={r.id}
                  to="/projects/$id"
                  params={{ id: r.id }}
                  className="rounded-xl bg-surface p-4 shadow-[0_0_0_1px_rgb(255_255_255/0.07)] transition-[box-shadow] hover:shadow-[0_0_0_1px_rgb(255_255_255/0.14)]"
                >
                  <p className="font-medium">{r.name}</p>
                  <p className="mt-1 text-sm text-muted">
                    {o
                      ? `This project shares approximately ${o.percent}% of its purpose with ${o.name}. Consider merging the useful components instead of maintaining both.`
                      : r.description}
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </Section>

      <Section title="The graveyard" kicker="Safe to archive" href="/graveyard">
        <div className="grid gap-3 md:grid-cols-2">
          {buried.map((r) => (
            <ProjectCard key={r.id} repo={r} compact />
          ))}
        </div>
      </Section>
    </div>
  );
}
