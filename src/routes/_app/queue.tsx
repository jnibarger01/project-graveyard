import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import { RecBadge } from "@/components/rec-badge";
import { Button } from "@/components/ui/button";
import { WORK_RANGE } from "@/lib/format";
import { persistGraveyard } from "@/lib/persist";
import { queuedRepos } from "@/lib/stats";
import { useGraveyard } from "@/lib/store";

export const Route = createFileRoute("/_app/queue")({
  component: QueuePage,
});

function QueuePage() {
  const repos = useGraveyard((s) => s.repos);
  const moveQueue = useGraveyard((s) => s.moveQueue);
  const dequeue = useGraveyard((s) => s.dequeue);
  const queue = queuedRepos(repos);

  function act(fn: () => void) {
    fn();
    void persistGraveyard();
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-subtle">Resurrection</p>
        <h1 className="mt-1 font-serif text-4xl tracking-tight">Queue</h1>
        <p className="mt-2 max-w-xl text-sm text-muted">
          Ordered work. Each card includes an MVP definition, the first task, and a definition of done — override
          freely.
        </p>
      </header>

      {queue.length === 0 ? (
        <div className="rounded-xl bg-surface p-8 text-center shadow-[0_0_0_1px_rgb(255_255_255/0.07)]">
          <p className="font-serif text-2xl">Nothing queued</p>
          <p className="mt-2 text-sm text-muted">Add a project from its page when you decide it is worth finishing.</p>
          <Link to="/projects" className="mt-4 inline-block text-sm underline-offset-4 hover:underline">
            Browse projects
          </Link>
        </div>
      ) : (
        <ol className="space-y-3">
          {queue.map((r, i) => (
            <li
              key={r.id}
              className="rounded-xl bg-surface p-5 shadow-[0_0_0_1px_rgb(255_255_255/0.07)]"
            >
              <div className="flex flex-wrap items-start gap-3">
                <span className="font-serif text-2xl tabular-nums text-subtle">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link to="/projects/$id" params={{ id: r.id }} className="font-medium hover:underline">
                      {r.name}
                    </Link>
                    <RecBadge rec={r.analysis.recommendation} />
                    <span className="text-xs text-muted">{WORK_RANGE[r.analysis.workRemaining].label}</span>
                  </div>
                  <p className="mt-2 text-sm text-muted">{r.analysis.mvpDefinition}</p>
                  <p className="mt-3 text-xs uppercase tracking-wide text-subtle">First task</p>
                  <p className="text-sm">{r.analysis.firstTask}</p>
                  <p className="mt-3 text-xs uppercase tracking-wide text-subtle">Done when</p>
                  <p className="text-sm text-muted">{r.analysis.definitionOfDone}</p>
                  <ol className="mt-3 space-y-1 text-sm text-muted">
                    {r.analysis.taskList.slice(0, 4).map((t, idx) => (
                      <li key={t.id}>
                        {idx + 1}. {t.title}
                      </li>
                    ))}
                  </ol>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Move up"
                    onClick={() => act(() => moveQueue(r.id, -1))}
                    disabled={i === 0}
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Move down"
                    onClick={() => act(() => moveQueue(r.id, 1))}
                    disabled={i === queue.length - 1}
                  >
                    <ArrowDown />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Remove from queue"
                    onClick={() => act(() => dequeue(r.id))}
                  >
                    <X />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
