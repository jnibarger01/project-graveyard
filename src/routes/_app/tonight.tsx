import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { RecBadge } from "@/components/rec-badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toDecision } from "@/lib/analysis";
import { budgetLabel, rankTonight, BUDGET_HOURS, type TimeBudget } from "@/lib/scan/tonight.ts";
import { useGraveyard } from "@/lib/store";

export const Route = createFileRoute("/_app/tonight")({
  component: TonightPage,
});

const BUDGETS: TimeBudget[] = ["30min", "1h", "2h", "evening", "weekend"];

function TonightPage() {
  const repos = useGraveyard((s) => s.repos);
  const [budget, setBudget] = useState<TimeBudget>("1h");

  const candidates = rankTonight(
    repos.map((r) => ({
      repoId: r.id,
      name: r.name,
      description: r.description,
      decision: toDecision(r),
      evidence: r.analysis.scan,
      userStatus: r.userStatus,
    })),
    budget,
  );

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-subtle">Tonight</p>
        <h1 className="mt-1 font-serif text-4xl tracking-tight">What should I work on?</h1>
        <p className="mt-2 max-w-xl text-sm text-muted">
          Pick a time budget and Graveyard ranks your projects by expected value — how much a single session moves the
          closest project toward a real milestone.
        </p>
      </header>

      <Tabs value={budget} onValueChange={(v) => setBudget(v as TimeBudget)}>
        <TabsList>
          {BUDGETS.map((b) => (
            <TabsTrigger key={b} value={b}>
              {budgetLabel(b)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {candidates.length === 0 ? (
        <div className="rounded-xl bg-surface p-8 text-center shadow-[0_0_0_1px_rgb(255_255_255/0.07)]">
          <p className="font-serif text-2xl">Nothing actionable in {budgetLabel(budget)}</p>
          <p className="mt-2 text-sm text-muted">
            No project offers bounded work worth starting right now. Try a longer budget, or add more repos.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-subtle">
            Budget: {budgetLabel(budget)} ({BUDGET_HOURS[budget]}h) · ranked by expected value
          </p>
          <ol className="space-y-3">
            {candidates.map((c, i) => (
              <li key={c.repoId} className="rounded-xl bg-surface p-5 shadow-[0_0_0_1px_rgb(255_255_255/0.07)]">
                <div className="flex flex-wrap items-start gap-3">
                  <span className="font-serif text-2xl tabular-nums text-subtle">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link to="/projects/$id" params={{ id: c.repoId }} className="font-medium hover:underline">
                        {c.name}
                      </Link>
                      <RecBadge rec={c.recommendation} />
                      <span className="text-xs text-subtle">value {c.expectedValue}/100</span>
                      {c.fitsTime ? (
                        <span className="text-xs text-emerald-400">fits {budgetLabel(budget)}</span>
                      ) : (
                        <span className="text-xs text-amber-400">needs more time</span>
                      )}
                      <span className="text-xs text-muted">est {c.estimatedHours}h</span>
                    </div>
                    <p className="mt-2 text-sm text-muted">{c.why}</p>
                    <p className="mt-3 text-xs uppercase tracking-wide text-subtle">Do this next</p>
                    <p className="text-sm">{c.doNext}</p>
                    <p className="mt-3 text-xs uppercase tracking-wide text-subtle">Done when</p>
                    <p className="text-sm text-muted">{c.definitionOfDone}</p>
                    <p className="mt-2 text-xs text-subtle">Then: {c.afterThat}</p>
                  </div>
                  <Button variant="secondary" size="sm" asChild>
                    <Link to="/projects/$id" params={{ id: c.repoId }}>
                      Open project
                    </Link>
                  </Button>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}