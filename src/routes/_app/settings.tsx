import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { persistGraveyard } from "@/lib/persist";
import { importFromGithub } from "@/lib/server/graveyard";
import { useGraveyard } from "@/lib/store";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const settings = useGraveyard((s) => s.settings);
  const setHumor = useGraveyard((s) => s.setHumor);
  const resetDemo = useGraveyard((s) => s.resetDemo);
  const replaceAll = useGraveyard((s) => s.replaceAll);
  const { user } = useCurrentUserState();
  const [token, setToken] = useState("");
  const [replaceDemo, setReplaceDemo] = useState(true);
  const [busy, setBusy] = useState(false);

  async function onImport() {
    if (!user) {
      toast("Sign in before importing GitHub repositories");
      return;
    }
    if (!token.trim()) {
      toast("Paste a GitHub personal access token first");
      return;
    }
    setBusy(true);
    try {
      const result = await importFromGithub({ data: { token: token.trim(), replaceDemo } });
      replaceAll(result.repos, result.settings);
      setToken("");
      toast(`Imported ${result.repos.filter((r) => r.source === "github").length} repositories for ${result.username}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "GitHub import failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <header>
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-subtle">Preferences</p>
        <h1 className="mt-1 font-serif text-4xl tracking-tight">Settings</h1>
      </header>

      <section className="rounded-xl bg-surface p-5 shadow-[0_0_0_1px_rgb(255_255_255/0.07)]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-medium">Humorous copy</h2>
            <p className="mt-1 text-sm text-muted">
              Epitaphs and “cause of death” lines. Analysis stays either way.
            </p>
          </div>
          <Switch
            checked={settings.humorEnabled}
            onCheckedChange={(on) => {
              setHumor(on);
              void persistGraveyard();
            }}
            aria-label="Toggle humorous copy"
          />
        </div>
      </section>

      <section className="space-y-4 rounded-xl bg-surface p-5 shadow-[0_0_0_1px_rgb(255_255_255/0.07)]">
        <div>
          <h2 className="font-medium">GitHub import</h2>
          <p className="mt-1 text-sm text-muted">
            App accounts use Google or X. To review your repositories, paste a GitHub personal access token with{" "}
            <code className="text-fg">repo</code> scope. The token is used once for this import and is not stored.
          </p>
        </div>
        {settings.githubUsername && (
          <p className="text-sm text-muted">
            Last import: @{settings.githubUsername}
            {settings.lastImportedAt ? ` · ${new Date(settings.lastImportedAt).toLocaleString()}` : ""}
          </p>
        )}
        <div className="space-y-2">
          <Label htmlFor="gh-token">Personal access token</Label>
          <Input
            id="gh-token"
            type="password"
            autoComplete="off"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="ghp_…"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={replaceDemo}
            onChange={(e) => setReplaceDemo(e.target.checked)}
          />
          Replace sample repositories
        </label>
        <Button onClick={() => void onImport()} disabled={busy}>
          {busy ? "Importing…" : "Import repositories"}
        </Button>
      </section>

      <section className="rounded-xl bg-surface p-5 shadow-[0_0_0_1px_rgb(255_255_255/0.07)]">
        <h2 className="font-medium">Sample graveyard</h2>
        <p className="mt-1 text-sm text-muted">
          Restore the 14-project demo dataset. Local decisions on the sample set will be overwritten.
        </p>
        <Button
          variant="secondary"
          className="mt-4"
          onClick={() => {
            resetDemo();
            void persistGraveyard();
            toast("Sample graveyard restored");
          }}
        >
          Restore sample data
        </Button>
      </section>
    </div>
  );
}
