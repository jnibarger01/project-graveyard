import { addDays, formatISO } from "date-fns";
import { ExternalLink, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { persistGraveyard } from "@/lib/persist";
import { useGraveyard } from "@/lib/store";
import type { Repo } from "@/lib/types";

export function ProjectActions({ repo }: { repo: Repo }) {
  const setStatus = useGraveyard((s) => s.setStatus);
  const setSnooze = useGraveyard((s) => s.setSnooze);
  const enqueue = useGraveyard((s) => s.enqueue);
  const dequeue = useGraveyard((s) => s.dequeue);

  function act(label: string, fn: () => void) {
    fn();
    void persistGraveyard();
    toast(label);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant={repo.userStatus === "active" ? "default" : "secondary"}
        size="sm"
        onClick={() => act("Marked active", () => setStatus(repo.id, "active"))}
      >
        Mark active
      </Button>
      <Button
        variant={repo.userStatus === "queued" ? "default" : "secondary"}
        size="sm"
        onClick={() =>
          act(
            repo.userStatus === "queued" ? "Removed from queue" : "Added to resurrection queue",
            () => (repo.userStatus === "queued" ? dequeue(repo.id) : enqueue(repo.id)),
          )
        }
      >
        {repo.userStatus === "queued" ? "Remove from queue" : "Add to queue"}
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={() =>
          act("Snoozed for 30 days", () => setSnooze(repo.id, formatISO(addDays(new Date(), 30))))
        }
      >
        Snooze 30 days
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => act("Marked finished", () => setStatus(repo.id, "finished"))}
      >
        Mark finished
      </Button>
      <Button variant="outline" size="sm" asChild>
        <a href={repo.htmlUrl} target="_blank" rel="noreferrer">
          Open on GitHub
          <ExternalLink className="size-3.5" />
        </a>
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="More actions">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => act("Cleared snooze", () => setSnooze(repo.id, undefined))}>
            Clear snooze
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => act("Reset decision", () => setStatus(repo.id, "none"))}>
            Reset decision
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                Mark intentionally abandoned
              </DropdownMenuItem>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Abandon {repo.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This records the decision here. It does not delete or archive the GitHub repository.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => act("Marked abandoned", () => setStatus(repo.id, "abandoned"))}>
                  Confirm
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>Archive on GitHub…</DropdownMenuItem>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Archive {repo.name} on GitHub?</AlertDialogTitle>
                <AlertDialogDescription>
                  Project Graveyard will not archive or delete repositories for you. Confirming opens GitHub
                  settings in a new tab and marks this project abandoned locally.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    act("Marked abandoned — finish archive on GitHub", () => setStatus(repo.id, "abandoned"));
                    window.open(`${repo.htmlUrl}/settings`, "_blank", "noreferrer");
                  }}
                >
                  Open GitHub settings
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
