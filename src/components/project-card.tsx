import { Link } from "@tanstack/react-router";
import { RecBadge } from "@/components/rec-badge";
import { ScoreRing } from "@/components/score-ring";
import { Progress } from "@/components/ui/progress";
import { STATE_COPY, WORK_RANGE, languageList, relativeActivity } from "@/lib/format";
import type { Repo } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ProjectCard({ repo, compact = false }: { repo: Repo; compact?: boolean }) {
  const langs = languageList(repo);
  return (
    <Link
      to="/projects/$id"
      params={{ id: repo.id }}
      className={cn(
        "group block rounded-xl bg-surface p-4 shadow-[0_0_0_1px_rgb(255_255_255/0.08)] transition-[box-shadow,transform] duration-150 ease-out hover:shadow-[0_0_0_1px_rgb(255_255_255/0.16)]",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-medium text-fg">{repo.name}</h3>
            <RecBadge rec={repo.analysis.recommendation} />
            {repo.isPrivate ? (
              <span className="text-[11px] uppercase tracking-wide text-subtle">Private</span>
            ) : (
              <span className="text-[11px] uppercase tracking-wide text-subtle">Public</span>
            )}
          </div>
          <p className="mt-1 line-clamp-2 text-sm text-muted">{repo.description || repo.analysis.purpose}</p>
        </div>
        <ScoreRing score={repo.analysis.resurrectionScore} />
      </div>
      {!compact && (
        <div className="mt-4 space-y-3">
          <div>
            <div className="mb-1 flex items-center justify-between text-xs text-muted">
              <span>{STATE_COPY[repo.analysis.currentState]}</span>
              <span className="tabular-nums">{repo.analysis.completionPct}% complete</span>
            </div>
            <Progress value={repo.analysis.completionPct} />
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
            <span>{langs.join(" · ") || "Unknown stack"}</span>
            <span>Last activity {relativeActivity(repo.lastCommitAt)}</span>
            <span>Work remaining {WORK_RANGE[repo.analysis.workRemaining].label}</span>
          </div>
        </div>
      )}
    </Link>
  );
}
