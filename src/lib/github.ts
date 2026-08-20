import { analyzeRepo, type RepoSignals } from "./analysis";
import { buildEvidence, type ScanInput } from "./scan/evidence.ts";
import type { Repo, RepoScanEvidence } from "./types";

type GhRepo = {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  private: boolean;
  fork: boolean;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  pushed_at: string;
  created_at: string;
  updated_at: string;
  size: number;
  default_branch: string;
  html_url: string;
  homepage: string | null;
  topics?: string[];
  owner: { login: string };
};

const GH = "https://api.github.com";

function headers(token: string) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "project-graveyard",
  };
}

async function gh<T>(token: string, path: string, accept?: string): Promise<T> {
  const res = await fetch(`${GH}${path}`, {
    headers: accept ? { ...headers(token), Accept: accept } : headers(token),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub ${res.status}: ${text.slice(0, 180)}`);
  }
  if (res.status === 204) return null as T;
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("json")) return (await res.json()) as T;
  return (await res.text()) as T;
}

function detectFromTree(names: string[]) {
  const lower = names.map((n) => n.toLowerCase());
  const has = (re: RegExp) => lower.some((n) => re.test(n));
  return {
    hasTests: has(/test|spec|__tests__|pytest/),
    hasCi: has(/^\.github$|gitlab-ci|circleci|jenkinsfile/),
    hasDeploy: has(/dockerfile|docker-compose|vercel|netlify|fly\.toml|render\.yaml|procfile|kubernetes|helm/),
    hasAuth: has(/auth|better-auth|passport|next-auth/),
    hasDb: has(/prisma|drizzle|migrations|schema\.sql|supabase|knex/),
    packageManifests: names.filter((n) =>
      /package\.json|pnpm-lock|yarn\.lock|go\.mod|pyproject|cargo\.toml|composer\.json|gemfile|requirements\.txt/i.test(
        n,
      ),
    ),
    frameworks: detectFrameworks(names),
  };
}

function detectFrameworks(names: string[]) {
  const blob = names.join(" ").toLowerCase();
  const out: string[] = [];
  if (blob.includes("package.json")) out.push("Node");
  if (names.some((n) => n.toLowerCase() === "next.config.ts" || n.toLowerCase() === "next.config.js"))
    out.push("Next.js");
  if (names.some((n) => n.toLowerCase() === "vite.config.ts")) out.push("Vite");
  if (blob.includes("go.mod")) out.push("Go");
  if (blob.includes("pyproject") || blob.includes("requirements")) out.push("Python");
  if (blob.includes("cargo.toml")) out.push("Rust");
  if (blob.includes("dockerfile")) out.push("Docker");
  return out;
}

function readmeQuality(md: string) {
  if (!md) return 8;
  let q = 20;
  if (md.length > 400) q += 20;
  if (md.length > 1200) q += 15;
  if (/^# /m.test(md)) q += 10;
  if (/install/i.test(md)) q += 10;
  if (/usage|getting started/i.test(md)) q += 10;
  if (/license/i.test(md)) q += 5;
  if (/!\[/.test(md)) q += 5;
  return Math.min(95, q);
}

function todoCount(md: string) {
  return (md.match(/TODO|FIXME/g) ?? []).length;
}

export async function fetchGithubUser(token: string) {
  const user = await gh<{ login: string; name: string | null; avatar_url: string }>(token, "/user");
  return user;
}

/** Files whose contents are worth fetching for a deep scan (manifests/configs). */
const DEEP_SCAN_KEY_FILES = [
  "package.json", "tsconfig.json", "vite.config.ts", "vite.config.js", "next.config.ts", "next.config.js",
  "pyproject.toml", "requirements.txt", "go.mod", "Cargo.toml", "Gopkg.toml",
  ".env.example", ".env.sample", "docker-compose.yml", "docker-compose.yaml", "Dockerfile",
  "prisma/schema.prisma", "drizzle.config.ts", "pnpm-workspace.yaml", "turbo.json", "lerna.json",
];

/** Directories whose source files we sample for unfinished-work markers. */
const DEEP_SCAN_SOURCE_DIRS = ["src", "app", "lib", "client", "server", "cmd", "internal", "pkg", "core", "graph", "web", "scripts"];

/**
 * Deep scan: fetch the recursive git tree and a bounded sample of file contents,
 * then build structured evidence. Bounded and read-only — never executes the
 * repository's code. Treats the repo as untrusted input.
 */
export async function deepScanGithubRepo(token: string, fullName: string, defaultBranch: string): Promise<{ evidence: RepoScanEvidence; commitSha: string | null; tree: string[] }> {
  const treeRes = await gh<{ sha: string; truncated?: boolean; tree?: { path?: string; type?: string }[] }>(
    token,
    `/repos/${fullName}/git/trees/${encodeURIComponent(defaultBranch)}?recursive=1`,
  );
  const commitSha = treeRes.sha ?? null;
  const paths = (treeRes.tree ?? [])
    .map((t) => t.path ?? "")
    .filter((p) => !/node_modules\/|\.git\/|dist\/|build\/|\.next\/|\.venv\/|target\/|vendor\/|__pycache__\//.test(p));

  const contents: Record<string, string> = {};
  const sourceDirs = DEEP_SCAN_SOURCE_DIRS.map((d) => `${d}/`);
  let sampled = 0;
  for (const p of paths) {
    const isKey = DEEP_SCAN_KEY_FILES.includes(p);
    const isSource = sourceDirs.some((d) => p.startsWith(d)) && /\.(ts|tsx|js|jsx|py|go|rs|rb|java|cs|sh)$/.test(p);
    const isReadme = /^readme(\.[a-z]+)?$/i.test(p);
    if (!isKey && !isSource && !isReadme) continue;
    if (isSource && sampled >= 40) continue;
    try {
      const raw = await gh<string>(token, `/repos/${fullName}/contents/${p}`, "application/vnd.github.raw");
      if (typeof raw === "string" && raw.length > 0) {
        contents[p] = raw.slice(0, 40_000);
        if (isSource) sampled += 1;
      }
    } catch {
      /* ignore per-file fetch errors */
    }
  }

  const readme = contents["README.md"] ?? Object.entries(contents).find(([p]) => /^readme/i.test(p))?.[1] ?? "";
  const input: ScanInput = {
    fileTree: paths.slice(0, 2000),
    readme,
    fileContents: contents,
  };
  const evidence = buildEvidence(input);
  return { evidence, commitSha, tree: paths.slice(0, 2000) };
}

export async function importGithubRepos(token: string, existing: Repo[]): Promise<Repo[]> {
  const list = await gh<GhRepo[]>(
    token,
    "/user/repos?per_page=40&sort=pushed&affiliation=owner&type=all",
  );
  const owned = list.filter((r) => !r.fork).slice(0, 24);
  const signals: RepoSignals[] = [];

  for (const r of owned) {
    let languages: Record<string, number> = r.language ? { [r.language]: 1 } : {};
    let tree: string[] = [];
    let readme = "";
    let branchCount = 1;
    let openPrs = 0;
    try {
      languages = await gh<Record<string, number>>(token, `/repos/${r.full_name}/languages`);
    } catch {
      /* ignore */
    }
    try {
      const contents = await gh<{ name: string; type: string }[]>(token, `/repos/${r.full_name}/contents/`);
      tree = (contents ?? []).map((c) => c.name);
    } catch {
      /* ignore */
    }
    try {
      readme = await gh<string>(token, `/repos/${r.full_name}/readme`, "application/vnd.github.raw");
    } catch {
      /* ignore */
    }
    try {
      const branches = await gh<{ name: string }[]>(token, `/repos/${r.full_name}/branches?per_page=20`);
      branchCount = branches.length;
    } catch {
      /* ignore */
    }
    try {
      const prs = await gh<unknown[]>(token, `/repos/${r.full_name}/pulls?state=open&per_page=10`);
      openPrs = prs.length;
    } catch {
      /* ignore */
    }

    const detected = detectFromTree(tree);
    const id = `gh-${r.id}`;
    signals.push({
      id,
      githubId: r.id,
      name: r.name,
      fullName: r.full_name,
      description: r.description ?? "",
      isPrivate: r.private,
      isFork: r.fork,
      language: r.language ?? Object.keys(languages)[0] ?? "Unknown",
      languages,
      stars: r.stargazers_count,
      forks: r.forks_count,
      openIssues: Math.max(0, r.open_issues_count - openPrs),
      openPrs,
      lastCommitAt: r.pushed_at,
      createdAtGh: r.created_at,
      pushedAt: r.pushed_at,
      sizeKb: r.size,
      defaultBranch: r.default_branch,
      branchCount,
      commitCount: Math.max(1, Math.round(r.size / 20)),
      readmeQuality: readmeQuality(typeof readme === "string" ? readme : ""),
      hasTests: detected.hasTests,
      hasCi: detected.hasCi,
      hasDeploy: detected.hasDeploy,
      hasAuth: detected.hasAuth,
      hasDb: detected.hasDb,
      todoCount: todoCount(typeof readme === "string" ? readme : ""),
      frameworks: detected.frameworks.length ? detected.frameworks : r.language ? [r.language] : [],
      topics: r.topics ?? [],
      homepage: r.homepage ?? undefined,
      htmlUrl: r.html_url,
      fileTree: tree,
      packageManifests: detected.packageManifests,
      scanEvidence: buildEvidence({
        fileTree: tree,
        readme: typeof readme === "string" ? readme : "",
        fileContents: {},
        languageBytes: languages,
      }),
      source: "github",
    });
  }

  const imported: Repo[] = signals.map((s) => {
    const prior = existing.find((e) => e.githubId === s.githubId || e.fullName === s.fullName);
    return {
      ...s,
      userStatus: prior?.userStatus ?? "none",
      userNotes: prior?.userNotes ?? "",
      snoozedUntil: prior?.snoozedUntil,
      queuePosition: prior?.queuePosition ?? null,
      analysis: analyzeRepo(s, signals),
      scanEvidence: s.scanEvidence,
    };
  });

  return imported;
}
