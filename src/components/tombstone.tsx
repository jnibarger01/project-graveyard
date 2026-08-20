import { Link } from "@tanstack/react-router";
import { formatShortDate } from "@/lib/format";
import type { Repo } from "@/lib/types";
import { RecBadge } from "./rec-badge";

export function Tombstone({ repo, humor }: { repo: Repo; humor: boolean }) {
  return (
    <Link
      to="/projects/$id"
      params={{ id: repo.id }}
      className="tombstone group block rounded-t-[2.25rem] rounded-b-lg px-5 pb-5 pt-8 transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_0_0_1px_rgb(255_255_255/0.16)]"
    >
      <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-fg/15" />
      <h3 className="font-serif text-xl tracking-tight">{repo.name}</h3>
      <p className="mt-2 text-xs uppercase tracking-wide text-subtle">
        Born {formatShortDate(repo.analysis.bornDate)}
        <span className="mx-2 text-border-strong">·</span>
        Last commit {formatShortDate(repo.lastCommitAt)}
      </p>
      <p className="mt-4 text-sm text-muted">
        {humor ? (
          <>
            <span className="italic text-fg/80">“{repo.analysis.epitaph}”</span>
            <span className="mt-2 block text-xs text-subtle">Cause of death: {repo.analysis.causeOfDeath}</span>
          </>
        ) : (
          <>Cause of inactivity: {repo.analysis.causeOfDeath}</>
        )}
      </p>
      <div className="mt-4">
        <RecBadge rec={repo.analysis.recommendation} />
      </div>
    </Link>
  );
}
