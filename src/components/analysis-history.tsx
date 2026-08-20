import { ExternalLink, History, ScanSearch, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { RecBadge } from "@/components/rec-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  decideAction,
  listProposedActions,
  proposeAction,
  type ProposedAction,
} from "@/lib/server/actions";
import { compareAnalysisRuns, loadAnalysisHistory, type AnalysisRun } from "@/lib/server/history";
import { deepScanRepo } from "@/lib/server/graveyard";
import { useGraveyard } from "@/lib/store";
import { formatLongDate } from "@/lib/format";
import type { Analysis, Repo } from "@/lib/types";

function confidenceLabel(c: Analysis["recommendationConfidence"] | undefined): string {
  return c ?? "low";
}

export function AnalysisHistory({ repo }: { repo: Repo }) {
  const updateRepo = useGraveyard((s) => s.updateRepo);
  const [runs, setRuns] = useState<AnalysisRun[]>([]);
  const [actions, setActions] = useState<ProposedAction[]>([]);
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState("");

  async function refresh() {
    const [hist, acts] = await Promise.all([
      loadAnalysisHistory({ data: { repoId: repo.id, limit: 6 } }),
      listProposedActions({ data: { repoId: repo.id } }),
    ]);
    setRuns(hist);
    setActions(acts);
  }

  useEffect(() => {
    void refresh().catch(() => toast("Could not load analysis history"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo.id]);

  async function propose() {
    setBusy(true);
    try {
      const res = await proposeAction({ data: { repo } });
      if (!res.ok) toast(res.reason);
      else {
        toast("Proposal recorded — nothing was executed");
        await refresh();
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not propose an action");
    } finally {
      setBusy(false);
    }
  }

  async function decide(id: string, decision: "approved" | "declined") {
    try {
      const updated = await decideAction({ data: { id, decision } });
      setActions((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      toast(decision === "approved" ? "Approved — you can now perform it manually" : "Declined");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not update the action");
    }
  }

  async function runDeepScan() {
    if (!token.trim()) {
      toast("A GitHub token is required for a deep scan");
      return;
    }
    setBusy(true);
    try {
      const next = await deepScanRepo({ data: { id: repo.id, token: token.trim() } });
      updateRepo(repo.id, next);
      toast(next.analysis.source === "llm" ? "Deep scan + Grok review complete" : "Deep scan complete — AI unavailable");
      setToken("");
      await refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Deep scan failed");
    } finally {
      setBusy(false);
    }
  }

  const canDeepScan = repo.source === "github" && !!repo.fullName && !!repo.defaultBranch;

  return (
    <div className="space-y-5">
      <section className="rounded-xl bg-surface p-5 shadow-[0_0_0_1px_rgb(255_255_255/0.07)]">
        <div className="flex items-center gap-2">
          <History className="size-4 text-subtle" />
          <h2 className="text-xs font-medium uppercase tracking-wide text-subtle">Analysis history</h2>
        </div>
        <p className="mt-1 text-xs text-subtle">
          Each re-analysis is stored as an immutable snapshot — nothing is overwritten, so you can see how the verdict changed.
        </p>
        {runs.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No snapshots yet. Run a re-analysis to record the first one.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {runs.map((run, i) => (
              <li
                key={run.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-elevated px-3 py-2 text-sm"
              >
                <span className="text-xs text-subtle">#{runs.length - i}</span>
                <RecBadge rec={run.analysis.recommendation} />
                <span className="text-muted">
                  Readiness {run.analysis.readiness ?? run.analysis.completionPct}
                  <span className="text-subtle"> · confidence {confidenceLabel(run.analysis.recommendationConfidence)}</span>
                </span>
                <span className="ml-auto text-xs text-subtle">
                  {run.commitSha ? `@${run.commitSha.slice(0, 7)} · ` : ""}
                  {formatLongDate(run.analyzedAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl bg-surface p-5 shadow-[0_0_0_1px_rgb(255_255_255/0.07)]">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-subtle" />
          <h2 className="text-xs font-medium uppercase tracking-wide text-subtle">Proposed actions</h2>
        </div>
        <p className="mt-1 text-xs text-subtle">
          Graveyard can suggest the next step from the recommendation. Approving only records intent — it never writes to GitHub for you.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => void propose()} disabled={busy}>
            Propose action for {repo.name}
          </Button>
        </div>
        {actions.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No proposals yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {actions.map((a) => (
              <li key={a.id} className="rounded-lg bg-elevated px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{a.title}</span>
                  <span
                    className={
                      a.status === "approved"
                        ? "text-xs text-emerald-400"
                        : a.status === "declined"
                          ? "text-xs text-red-400"
                          : "text-xs text-subtle"
                    }
                  >
                    {a.status}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted">{a.description}</p>
                {a.definitionOfDone && (
                  <p className="mt-1 text-xs text-subtle">Done when: {a.definitionOfDone}</p>
                )}
                {a.status === "proposed" && (
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" onClick={() => void decide(a.id, "approved")}>
                      Approve (record only)
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => void decide(a.id, "declined")}>
                      Decline
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {canDeepScan && (
        <section className="rounded-xl bg-surface p-5 shadow-[0_0_0_1px_rgb(255_255_255/0.07)]">
          <div className="flex items-center gap-2">
            <ScanSearch className="size-4 text-subtle" />
            <h2 className="text-xs font-medium uppercase tracking-wide text-subtle">Deep scan</h2>
          </div>
          <p className="mt-1 text-xs text-subtle">
            Fetch the full file tree and a sample of source to raise evidence and confidence. Needs a GitHub token; it is used
            once and not stored.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Input
              type="password"
              placeholder="GitHub personal access token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="sm:max-w-xs"
            />
            <Button size="sm" onClick={() => void runDeepScan()} disabled={busy || !token.trim()}>
              {busy ? "Scanning…" : "Deep scan"}
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <a href={`https://github.com/settings/tokens`} target="_blank" rel="noreferrer">
                Get a token <ExternalLink className="size-3.5" />
              </a>
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}