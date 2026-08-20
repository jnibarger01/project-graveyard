import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { cloneDemoRepos, DEFAULT_SETTINGS } from "@/lib/demo-data";
import type { GraveyardSettings, Repo } from "@/lib/types";
import { recordAnalysisRun } from "./history";

type Row = { payload: unknown };
type SettingRow = {
  humor_enabled: boolean;
  github_username: string | null;
  last_imported_at: string | null;
};

function asRepo(payload: unknown): Repo {
  return (typeof payload === "string" ? JSON.parse(payload) : payload) as Repo;
}

async function readBundle(userId: string) {
  const sql = await getSql();
  const settingRows = await sql<SettingRow>`
    select humor_enabled, github_username, last_imported_at
    from graveyard_settings where user_id = ${userId}
  `;
  const repoRows = await sql<Row>`select payload from graveyard_repos where user_id = ${userId}`;
  const settings: GraveyardSettings = settingRows[0]
    ? {
        humorEnabled: Boolean(settingRows[0].humor_enabled),
        githubUsername: settingRows[0].github_username,
        lastImportedAt: settingRows[0].last_imported_at,
      }
    : { ...DEFAULT_SETTINGS };
  return { repos: repoRows.map((r) => asRepo(r.payload)), settings };
}

async function writeBundle(userId: string, repos: Repo[], settings: GraveyardSettings) {
  const sql = await getSql();
  await sql.query(
    `insert into graveyard_settings (user_id, humor_enabled, github_username, last_imported_at, updated_at)
     values ($1, $2, $3, $4, now())
     on conflict (user_id) do update set
       humor_enabled = excluded.humor_enabled,
       github_username = excluded.github_username,
       last_imported_at = excluded.last_imported_at,
       updated_at = now()`,
    [userId, settings.humorEnabled, settings.githubUsername, settings.lastImportedAt],
  );
  await sql.query(`delete from graveyard_repos where user_id = $1`, [userId]);
  for (const repo of repos) {
    await sql.query(
      `insert into graveyard_repos (id, user_id, payload, updated_at)
       values ($1, $2, $3::jsonb, now())`,
      [repo.id, userId, JSON.stringify(repo)],
    );
  }
}

/** Record immutable analysis snapshots for a set of repos (history baseline). */
async function recordSnapshots(userId: string, repos: Repo[]) {
  for (const repo of repos) {
    try {
      await recordAnalysisRun(userId, repo, repo.analysis);
    } catch {
      /* snapshot best-effort — never block a save on history */
    }
  }
}

export const loadGraveyard = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => readBundle(context.userId));

export const saveGraveyard = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { repos: Repo[]; settings: GraveyardSettings }) => input)
  .handler(async ({ context, data }) => {
    await writeBundle(context.userId, data.repos, data.settings);
    return { ok: true as const };
  });

export const seedDemoIfEmpty = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const current = await readBundle(context.userId);
    if (current.repos.length > 0) return { ...current, seeded: false };
    const repos = cloneDemoRepos();
    const settings = { ...DEFAULT_SETTINGS };
    await writeBundle(context.userId, repos, settings);
    await recordSnapshots(context.userId, repos);
    return { repos, settings, seeded: true };
  });

export const importFromGithub = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { token: string; replaceDemo: boolean }) => input)
  .handler(async ({ context, data }) => {
    const token = data.token.trim();
    if (!token) throw new Error("A GitHub token is required");
    const { fetchGithubUser, importGithubRepos } = await import("@/lib/github");
    const user = await fetchGithubUser(token);
    const current = await readBundle(context.userId);
    const imported = await importGithubRepos(token, current.repos);
    const kept = data.replaceDemo
      ? current.repos.filter((r) => r.source === "github")
      : current.repos.filter((r) => r.source !== "github");
    const importedGhIds = new Set(imported.map((r) => r.githubId));
    const merged = [
      ...kept.filter((r) => r.githubId === undefined || !importedGhIds.has(r.githubId)),
      ...imported,
    ];
    const settings: GraveyardSettings = {
      humorEnabled: current.settings.humorEnabled,
      githubUsername: user.login,
      lastImportedAt: new Date().toISOString(),
    };
    await writeBundle(context.userId, merged, settings);
    await recordSnapshots(context.userId, imported);
    return { repos: merged, settings, username: user.login };
  });

export const reanalyzeRepo = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string }) => input)
  .handler(async ({ context, data }) => {
    const current = await readBundle(context.userId);
    const target = current.repos.find((r) => r.id === data.id);
    if (!target) throw new Error("Project not found");
    const { analyzeWithLlm } = await import("./ai");
    const analysis = await analyzeWithLlm(
      target,
      current.repos.filter((r) => r.id !== target.id),
    );
    const next = { ...target, analysis };
    const repos = current.repos.map((r) => (r.id === next.id ? next : r));
    await writeBundle(context.userId, repos, current.settings);
    await recordAnalysisRun(context.userId, next, analysis);
    return next;
  });

/**
 * Deep-scan a single repository by fetching its recursive tree and a bounded
 * sample of file contents (read-only; never executes repo code). Requires the
 * GitHub token because we do not persist it. Updates the repo's scan evidence
 * and re-runs the deterministic + AI analysis, recording a history snapshot.
 */
export const deepScanRepo = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; token: string }) => input)
  .handler(async ({ context, data }) => {
    const token = data.token.trim();
    if (!token) throw new Error("A GitHub token is required");
    const current = await readBundle(context.userId);
    const target = current.repos.find((r) => r.id === data.id);
    if (!target || target.source !== "github" || !target.fullName || !target.defaultBranch) {
      throw new Error("Project is not a GitHub repository that can be deep-scanned");
    }
    const { deepScanGithubRepo } = await import("@/lib/github");
    const { evidence, commitSha, tree } = await deepScanGithubRepo(token, target.fullName, target.defaultBranch);
    const withEvidence: Repo = {
      ...target,
      scanEvidence: evidence,
      commitSha: commitSha ?? target.commitSha,
      fileTree: tree,
    };
    const { analyzeWithLlm } = await import("./ai");
    const analysis = await analyzeWithLlm(
      withEvidence,
      current.repos.filter((r) => r.id !== target.id),
    );
    const next = { ...withEvidence, analysis };
    const repos = current.repos.map((r) => (r.id === next.id ? next : r));
    await writeBundle(context.userId, repos, current.settings);
    await recordAnalysisRun(context.userId, next, analysis);
    return next;
  });
