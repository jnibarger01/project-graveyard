import { Link } from "@tanstack/react-router";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Meter } from "@/components/meter";
import { AnalysisHistory } from "@/components/analysis-history";
import { ProjectActions } from "@/components/project-actions";
import { RecBadge } from "@/components/rec-badge";
import { ScoreRing } from "@/components/score-ring";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  RECOMMENDATION_COPY,
  STATE_COPY,
  STATUS_COPY,
  WORK_RANGE,
  formatLongDate,
  languageList,
  relativeActivity,
} from "@/lib/format";
import { persistGraveyard } from "@/lib/persist";
import { reanalyzeRepo } from "@/lib/server/graveyard";
import { useGraveyard } from "@/lib/store";
import { RECOMMENDATIONS, type Repo } from "@/lib/types";

export function ProjectDetail({ repo }: { repo: Repo }) {
  const humor = useGraveyard((s) => s.settings.humorEnabled);
  const setNotes = useGraveyard((s) => s.setNotes);
  const overrideAnalysis = useGraveyard((s) => s.overrideAnalysis);
  const updateRepo = useGraveyard((s) => s.updateRepo);
  const { user } = useCurrentUserState();
  const [notes, setLocalNotes] = useState(repo.userNotes);
  const [busy, setBusy] = useState(false);
  const langs = languageList(repo);
  const a = repo.analysis;

  async function saveNotes() {
    setNotes(repo.id, notes);
    await persistGraveyard();
    toast("Notes saved");
  }

  async function runAi() {
    if (!user) {
      toast("Sign in to re-analyze with Grok");
      return;
    }
    setBusy(true);
    try {
      const next = await reanalyzeRepo({ data: { id: repo.id } });
      updateRepo(repo.id, next);
      toast(next.analysis.source === "llm" ? "Grok analysis updated" : "Heuristic analysis updated — AI unavailable");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="space-y-6">
      <Link to="/projects" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
        <ArrowLeft className="size-4" /> All projects
      </Link>

      <header className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-[0.14em] text-subtle">{repo.fullName}</p>
          <h1 className="mt-1 font-serif text-4xl tracking-tight">{repo.name}</h1>
          <p className="mt-2 max-w-2xl text-muted">{repo.description || a.purpose}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <RecBadge rec={a.recommendation} />
            <span className="text-sm text-muted">{STATE_COPY[a.currentState]}</span>
            <span className="text-sm text-subtle">·</span>
            <span className="text-sm text-muted">{STATUS_COPY[repo.userStatus]}</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wide text-subtle">Resurrection</p>
            <p className="font-serif text-3xl tabular-nums">{a.resurrectionScore}</p>
          </div>
          <ScoreRing score={a.resurrectionScore} size={72} />
        </div>
      </header>

      <ProjectActions repo={repo} />

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-wide text-subtle">Override fate</span>
        <Select
          value={a.recommendation}
          onValueChange={(v) => {
            overrideAnalysis(repo.id, v as Repo["analysis"]["recommendation"]);
            void persistGraveyard();
          }}
        >
          <SelectTrigger className="w-48" aria-label="Override recommendation">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RECOMMENDATIONS.map((r) => (
              <SelectItem key={r} value={r}>
                {RECOMMENDATION_COPY[r].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="secondary" size="sm" onClick={() => void runAi()} disabled={busy}>
          <RefreshCw className="size-3.5" />
          {busy ? "Analyzing…" : "Re-analyze with Grok"}
        </Button>
        <span className="text-xs text-subtle">
          {a.source === "llm" ? "Last pass: Grok" : a.source === "seed" ? "Seeded assessment" : "Heuristic estimate"}
        </span>
      </div>

      <Tabs defaultValue="assessment">
        <TabsList className="h-auto w-full flex-wrap justify-start">
          <TabsTrigger value="assessment">Assessment</TabsTrigger>
          <TabsTrigger value="work">Work remaining</TabsTrigger>
          <TabsTrigger value="value">Value</TabsTrigger>
          <TabsTrigger value="overlap">Overlap</TabsTrigger>
          <TabsTrigger value="plan">Finish plan</TabsTrigger>
          <TabsTrigger value="history">History & actions</TabsTrigger>
        </TabsList>

        <TabsContent value="assessment" className="grid gap-4 lg:grid-cols-5">
          <div className="space-y-4 rounded-xl bg-surface p-5 shadow-[0_0_0_1px_rgb(255_255_255/0.07)] lg:col-span-3">
            <h2 className="font-serif text-2xl">What this project is</h2>
            <p className="text-sm leading-relaxed text-fg/90">{a.purpose}</p>
            <h3 className="pt-2 text-xs font-medium uppercase tracking-wide text-subtle">Recommended fate</h3>
            <p className="text-sm leading-relaxed">{a.recommendationReason}</p>
            {humor ? (
              <blockquote className="border-l border-border pl-3 font-serif italic text-muted">
                “{a.epitaph}”
                <footer className="mt-1 font-sans text-xs not-italic text-subtle">
                  Cause of death: {a.causeOfDeath}
                </footer>
              </blockquote>
            ) : (
              <p className="text-sm text-muted">Cause of inactivity: {a.causeOfDeath}</p>
            )}
          </div>
          <div className="space-y-3 rounded-xl bg-surface p-5 shadow-[0_0_0_1px_rgb(255_255_255/0.07)] lg:col-span-2">
            <h2 className="text-xs font-medium uppercase tracking-wide text-subtle">Observed facts</h2>
            <ul className="space-y-2 text-sm text-muted">
              {a.facts.map((f) => (
                <li key={f}>{f}</li>
              ))}
              <li>Stack: {langs.join(", ") || "unknown"}</li>
              <li>Last activity {relativeActivity(repo.lastCommitAt)} ({formatLongDate(repo.lastCommitAt)})</li>
              <li>
                {repo.commitCount} commits · {repo.branchCount} branches · {repo.sizeKb} kb
              </li>
            </ul>
            <h2 className="pt-3 text-xs font-medium uppercase tracking-wide text-subtle">Estimates / assumptions</h2>
            <ul className="space-y-2 text-sm text-muted">
              {a.assumptions.map((f) => (
                <li key={f}>{f}</li>
              ))}
              <li>Completion {a.completionPct}% is an estimate, not a measured burndown.</li>
            </ul>
          </div>
        </TabsContent>

        <TabsContent value="work" className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl bg-surface p-5 shadow-[0_0_0_1px_rgb(255_255_255/0.07)]">
            <p className="text-xs uppercase tracking-wide text-subtle">Work remaining</p>
            <p className="mt-1 font-serif text-3xl">{WORK_RANGE[a.workRemaining].label}</p>
            <p className="mt-1 text-sm text-muted">
              {a.completionPct}% complete · complexity {a.complexity}/5 · maintenance burden {a.maintenanceBurden}
            </p>
            <h3 className="mt-5 text-xs font-medium uppercase tracking-wide text-subtle">What's missing</h3>
            <ul className="mt-2 flex flex-wrap gap-2">
              {a.whatsMissing.map((m) => (
                <li key={m} className="rounded-full bg-elevated px-3 py-1 text-sm">
                  {m}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl bg-surface p-5 shadow-[0_0_0_1px_rgb(255_255_255/0.07)]">
            <h3 className="text-xs font-medium uppercase tracking-wide text-subtle">Main tasks</h3>
            <ol className="mt-3 space-y-2 text-sm">
              {a.workTasks.map((t, i) => (
                <li key={t} className="flex gap-2">
                  <span className="tabular-nums text-subtle">{i + 1}.</span>
                  {t}
                </li>
              ))}
            </ol>
          </div>
        </TabsContent>

        <TabsContent value="value" className="rounded-xl bg-surface p-5 shadow-[0_0_0_1px_rgb(255_255_255/0.07)]">
          <p className="mb-4 text-xs text-subtle">Scores are AI/heuristic estimates (est), not measured metrics.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Meter label="Personal usefulness" value={a.personalUsefulness} hint="estimate" />
            <Meter label="Portfolio value" value={a.portfolioValue} hint="estimate" />
            <Meter label="Open-source value" value={a.ossValue} hint="estimate" />
            <Meter label="Commercial potential" value={a.commercialPotential} hint="estimate" />
            <Meter label="Technical learning" value={a.learningValue} hint="estimate" />
            <Meter label="Resurrection score" value={a.resurrectionScore} hint="estimate" />
          </div>
        </TabsContent>

        <TabsContent value="overlap" className="space-y-3">
          {a.overlaps.length === 0 ? (
            <p className="text-sm text-muted">No substantial overlap detected with other imported repositories.</p>
          ) : (
            a.overlaps.map((o) => (
              <Link
                key={o.repoId}
                to="/projects/$id"
                params={{ id: o.repoId }}
                className="block rounded-xl bg-surface p-5 shadow-[0_0_0_1px_rgb(255_255_255/0.07)] hover:shadow-[0_0_0_1px_rgb(255_255_255/0.14)]"
              >
                <p className="font-medium">
                  {o.name} · {o.percent}% overlap
                </p>
                <p className="mt-1 text-sm text-muted">{o.note}</p>
              </Link>
            ))
          )}
        </TabsContent>

        <TabsContent value="plan" className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl bg-surface p-5 shadow-[0_0_0_1px_rgb(255_255_255/0.07)]">
            <h3 className="font-serif text-xl">MVP</h3>
            <p className="mt-2 text-sm leading-relaxed">{a.mvpDefinition}</p>
            <p className="mt-4 text-xs uppercase tracking-wide text-subtle">Suggested first task</p>
            <p className="mt-1 text-sm">{a.firstTask}</p>
            <p className="mt-4 text-xs uppercase tracking-wide text-subtle">Definition of done</p>
            <p className="mt-1 text-sm text-muted">{a.definitionOfDone}</p>
          </div>
          <div className="rounded-xl bg-surface p-5 shadow-[0_0_0_1px_rgb(255_255_255/0.07)]">
            <h3 className="text-xs font-medium uppercase tracking-wide text-subtle">Milestones</h3>
            <ul className="mt-3 space-y-2 text-sm">
              {a.milestones.map((m) => (
                <li key={m.id} className="flex gap-2">
                  <span className="text-subtle">{m.done ? "✓" : "○"}</span>
                  {m.title}
                </li>
              ))}
            </ul>
            {a.blockers.length > 0 && (
              <>
                <h3 className="mt-5 text-xs font-medium uppercase tracking-wide text-subtle">Likely blockers</h3>
                <ul className="mt-2 space-y-1 text-sm text-muted">
                  {a.blockers.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </>
            )}
            {a.dependencies.length > 0 && (
              <>
                <h3 className="mt-5 text-xs font-medium uppercase tracking-wide text-subtle">Dependencies</h3>
                <p className="mt-1 text-sm text-muted">{a.dependencies.join(", ")}</p>
              </>
            )}
            <ol className="mt-5 space-y-2 text-sm">
              {a.taskList.map((t, i) => (
                <li key={t.id}>
                  <span className="text-subtle">{i + 1}. </span>
                  {t.title}{" "}
                  <span className="text-xs text-subtle">({WORK_RANGE[t.estimate].label})</span>
                </li>
              ))}
            </ol>
          </div>
        </TabsContent>
        <TabsContent value="history">
          <AnalysisHistory repo={repo} />
        </TabsContent>
      </Tabs>

      <section className="rounded-xl bg-surface p-5 shadow-[0_0_0_1px_rgb(255_255_255/0.07)]">
        <h2 className="text-xs font-medium uppercase tracking-wide text-subtle">Notes</h2>
        <Textarea
          className="mt-3"
          value={notes}
          onChange={(e) => setLocalNotes(e.target.value)}
          placeholder="Decisions, context, why you paused…"
        />
        <Button className="mt-3" size="sm" onClick={() => void saveNotes()}>
          Save notes
        </Button>
      </section>
    </article>
  );
}
