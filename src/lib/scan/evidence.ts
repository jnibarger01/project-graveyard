import type { RepoScanEvidence } from "./types.ts";

export interface ScanInput {
  fileTree: string[];
  readme: string;
  /** key file contents keyed by path (manifests, configs, sampled source). */
  fileContents?: Record<string, string>;
  languageBytes?: Record<string, number>;
}

const SRC_DIRS = ["src", "app", "lib", "client", "server", "cmd", "internal", "pkg", "core", "modules", "pages", "components", "graph", "web"];
const TEST_FILE = /(^|[._-])(test|spec)([._-]|$)|__tests__|_test\.py$|\.test\.|\.spec\.|test_\.py$|_spec\.rb$/i;
const TEST_DIRS = ["test", "tests", "__tests__", "spec", "specs", "e2e", "cypress", "playwright"];
const CI_FILES = [".github/workflows", ".github/actions", ".gitlab-ci.yml", "circleci", ".circleci", "jenkinsfile", "azure-pipelines.yml", "travis.yml", "buildkite", ".github/workflows/ci"];
const DEPLOY_FILES = ["vercel.json", "netlify.toml", "fly.toml", "render.yaml", "heroku.yml", "railway.json", "railway.toml", "serverless.yml", "wrangler.toml", "amplify.yml", "Pulumi.yaml", ".github/workflows/deploy", "k8s/", "kubernetes/", "helm/", "Procfile", "app.yaml", "Dockerfile", "docker-compose.yml", "docker-compose.yaml", "compose.yaml", "compose.yml"];
const DOCKER_FILES = ["Dockerfile", "docker-compose.yml", "docker-compose.yaml", "compose.yaml", "compose.yml", ".dockerignore"];
const MIGRATION_HINTS = ["migrations/", "db/migrations", "prisma/migrations", "drizzle", "alembic", ".sql", "knex", "sequelize", "schema.sql", "schema/"];
const RELEASE_HINTS = ["changelog", ".releaserc", "release.config", "semantic-release", "goreleaser", ".github/workflows/release", "HomebrewFormula", "deno.json"];
const ENV_HINTS = [".env.example", ".env.sample", ".envrc", "env.example", ".env.local.example", ".env.template", "config/settings"];
const MONOREPO_DIRS = ["packages/", "apps/", "modules/", "libs/", "services/", "components/", "platforms/"];

const LOCKFILES: [string, string][] = [
  ["pnpm-lock.yaml", "pnpm"],
  ["pnpm-lock.yml", "pnpm"],
  ["yarn.lock", "yarn"],
  ["package-lock.json", "npm"],
  ["bun.lockb", "bun"],
  ["bun.lock", "bun"],
  ["deno.lock", "deno"],
  ["go.mod", "go"],
  ["Cargo.toml", "cargo"],
  ["pyproject.toml", "poetry"],
  ["Pipfile", "pipenv"],
  ["requirements.txt", "pip"],
  ["requirements.in", "pip"],
  ["uv.lock", "uv"],
  ["Gemfile", "bundler"],
  ["composer.json", "composer"],
  ["poetry.lock", "poetry"],
];

const RUNTIME_FRAMEWORKS: Array<{ key: string; name: string }> = [
  { key: "next.config.", name: "Next.js" },
  { key: "nuxt.config.", name: "Nuxt" },
  { key: "vite.config.", name: "Vite" },
  { key: "svelte.config.", name: "Svelte" },
  { key: "astro.config.", name: "Astro" },
  { key: "remix.config.", name: "Remix" },
  { key: "angular.json", name: "Angular" },
  { key: "gatsby-config.", name: "Gatsby" },
  { key: "webpack.config.", name: "webpack" },
  { key: "rollup.config.", name: "Rollup" },
  { key: "esbuild", name: "esbuild" },
  { key: "go.mod", name: "Go" },
  { key: "Cargo.toml", name: "Rust/Cargo" },
  { key: "pyproject.toml", name: "Python" },
  { key: "requirements.txt", name: "Python" },
  { key: "manage.py", name: "Django" },
  { key: "app.py", name: "Flask/FastAPI" },
  { key: "drizzle.config.", name: "Drizzle" },
  { key: "prisma", name: "Prisma" },
  { key: "package.json", name: "Node.js" },
  { key: "serverless.yml", name: "Serverless" },
  { key: "Gemfile", name: "Ruby" },
  { key: "pom.xml", name: "Maven" },
  { key: "build.gradle", name: "Gradle" },
  { key: "Cakefile", name: "Makefile" },
];

const DB_HINTS = ["prisma", "drizzle", "schema.sql", "migrations", "supabase", "postgres", "postgis", "pg\\.", "mysql", "maria", "mongo", "mongoose", "sqlite", "redis", "knex", "sequelize", "typeorm", "better-sqlite3", "kysely"];
const AUTH_HINTS = ["better-auth", "next-auth", "passport", "auth.js", "clerk", "firebase", "supabase auth", "oauth", "keycloak", "jwt", "iron-session", "lucia"];
const API_HINTS = ["express", "fastify", "hono", "fastapi", "flask", "django", "rails", "trpc", "graphql", "apollo", "openapi", "grpc", "spring"];
const FRONTEND_HINTS = ["react", "next", "vue", "nuxt", "svelte", "sveltekit", "angular", "remix", "astro", "solid", "ember", "gatsby", "tailwind", "alpine"];
const BACKEND_HINTS = ["express", "fastify", "hono", "fastapi", "flask", "django", "rails", "spring", "next", "serverless", "go", "actix", "rocket"];

function detectFrameworks(paths: string[], packageJson?: string): string[] {
  const out = new Set<string>();
  const all = paths.map((p) => p.toLowerCase());
  for (const { key, name } of RUNTIME_FRAMEWORKS) {
    if (all.some((p) => p.includes(key.toLowerCase()))) out.add(name);
  }
  if (packageJson) {
    const blob = packageJson.toLowerCase();
    const deps: Record<string, string> = { ...parseDeps(packageJson).dependencies, ...parseDeps(packageJson).devDependencies };
    for (const [hint, label] of [
      ["react", "React"],
      ["next", "Next.js"],
      ["vue", "Vue"],
      ["svelte", "Svelte"],
      ["angular", "Angular"],
      ["astro", "Astro"],
      ["express", "Express"],
      ["fastify", "Fastify"],
      ["hono", "Hono"],
      ["tailwindcss", "Tailwind"],
      ["drizzle-orm", "Drizzle"],
      ["prisma", "Prisma"],
      ["@tanstack/react-router", "TanStack Router"],
      ["trpc", "tRPC"],
      ["graphql", "GraphQL"],
    ] as const) {
      if (hint in deps && blob.includes(hint)) out.add(label);
    }
  }
  return [...out];
}

function parseDeps(packageJson: string): {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  workspaces?: string[];
} {
  const empty = { dependencies: {} as Record<string, string>, devDependencies: {} as Record<string, string> };
  try {
    const j = JSON.parse(packageJson) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      workspaces?: string[] | { packages?: string[] };
    };
    const w = j.workspaces;
    const workspaces = Array.isArray(w) ? w : (w?.packages ?? undefined);
    return {
      dependencies: j.dependencies ?? {},
      devDependencies: j.devDependencies ?? {},
      workspaces,
    };
  } catch {
    return empty;
  }
}

function detectPackageManager(paths: string[]): string | null {
  const all = paths.map((p) => p.toLowerCase());
  for (const [file, pm] of LOCKFILES) {
    if (all.some((p) => p === file || p.endsWith(`/${file}`))) return pm;
  }
  return null;
}

function buildSystem(paths: string[], packageJson?: string): string[] {
  const out = new Set<string>();
  const all = paths.map((p) => p.toLowerCase());
  for (const [key, name] of [
    ["vite.config.", "Vite"],
    ["next.config.", "Next.js"],
    ["webpack.config.", "webpack"],
    ["rollup.config.", "Rollup"],
    ["esbuild", "esbuild"],
    ["tsup", "tsup"],
    ["turborepo", "Turborepo"],
    ["nx.json", "Nx"],
    ["makefile", "Make"],
    ["bazel", "Bazel"],
    ["cmakelists", "CMake"],
    ["gradle", "Gradle"],
    ["pom.xml", "Maven"],
    ["cargo.toml", "Cargo"],
    ["go.mod", "Go"],
    ["pyproject.toml", "Poetry"],
    ["tsconfig.json", "tsc"],
  ] as const) {
    if (all.some((p) => p.includes(key))) out.add(name);
  }
  if (packageJson) {
    const scripts = safeJson(packageJson)?.scripts;
    if (scripts) {
      const s = JSON.stringify(scripts).toLowerCase();
      for (const [k, name] of [
        ["\"build\"", "build script"],
        ["vite build", "Vite"],
        ["next build", "Next.js"],
        ["tsc", "tsc"],
      ] as const) {
        if (s.includes(k)) out.add(name);
      }
    }
  }
  return [...out];
}

function safeJson(text: string): Record<string, unknown> | null {
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function detectLanguage(languageBytes: Record<string, number>, paths: string[]): string[] {
  if (Object.keys(languageBytes).length > 0) {
    const top = Object.entries(languageBytes).sort((a, b) => b[1] - a[1]);
    return top.slice(0, 4).map(([l]) => l);
  }
  const extLang: Record<string, string> = {
    ".ts": "TypeScript", ".tsx": "TypeScript", ".js": "JavaScript", ".jsx": "JavaScript",
    ".py": "Python", ".go": "Go", ".rs": "Rust", ".rb": "Ruby", ".php": "PHP",
    ".java": "Java", ".kt": "Kotlin", ".swift": "Swift", ".cs": "C#",
    ".c": "C", ".cpp": "C++", ".h": "C", ".hpp": "C++", ".sh": "Shell",
    ".html": "HTML", ".css": "CSS", ".scss": "SCSS", ".sql": "SQL", ".vue": "Vue",
  };
  const counts: Record<string, number> = {};
  for (const p of paths) {
    const m = /\.([a-z0-9]+)$/i.exec(p);
    if (!m) continue;
    const lang = extLang[m[0].toLowerCase()] ?? m[1];
    counts[lang] = (counts[lang] ?? 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([l]) => l);
}

function detectTests(paths: string[]): { has: boolean; files: string[] } {
  const files = paths.filter((p) => {
    const base = p.split("/").pop() ?? "";
    return TEST_FILE.test(base) || TEST_DIRS.some((d) => p.toLowerCase().includes(`/${d}/`));
  });
  return { has: files.length > 0, files };
}

function testQuality(testFiles: string[], fileContents?: Record<string, string>): "none" | "minimal" | "some" | "good" {
  if (testFiles.length === 0) return "none";
  let asserts = 0;
  let files = 0;
  for (const f of testFiles) {
    const content = fileContents?.[f];
    if (content) {
      files += 1;
      asserts += (content.match(/(expect|assert|it\(|test\(|describe\(|should)/g) ?? []).length;
    }
  }
  if (files >= 5 && asserts >= 40) return "good";
  if (files >= 2 && asserts >= 10) return "some";
  if (files >= 1) return "minimal";
  return "none";
}

function documentationQuality(readme: string): "none" | "minimal" | "adequate" | "good" {
  if (!readme.trim()) return "none";
  let score = 0;
  if (readme.length > 400) score += 2;
  if (readme.length > 1500) score += 2;
  if (/^#/m.test(readme)) score += 1;
  if (/install|getting started|setup/i.test(readme)) score += 2;
  if (/usage|example/i.test(readme)) score += 2;
  if (/license|contributing|architecture|api/i.test(readme)) score += 1;
  if (score >= 8) return "good";
  if (score >= 5) return "adequate";
  return "minimal";
}

/** Scan lines of a source string for unfinished-work markers. */
export function scanForMarkers(content: string, file: string): { file: string; line: number; text: string }[] {
  const out: { file: string; line: number; text: string }[] = [];
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    const m = /(TODO|FIXME|HACK|XXX)\b[: -]*(.*)$/i.exec(lines[i]);
    if (m) out.push({ file, line: i + 1, text: m[0].trim().slice(0, 120) });
  }
  return out;
}

function collectMarkers(fileContents?: Record<string, string>): { todoMarkers: RepoScanEvidence["unfinished"]["todoMarkers"]; todoCount: number; fixmeCount: number; hackCount: number; xxxCount: number } {
  const todoMarkers: RepoScanEvidence["unfinished"]["todoMarkers"] = [];
  for (const [path, content] of Object.entries(fileContents ?? {})) {
    for (const m of scanForMarkers(content, path)) {
      todoMarkers.push(m);
    }
  }
  const t = todoMarkers.map((m) => m.text.toLowerCase());
  const count = (re: RegExp) => t.filter((x) => re.test(x)).length;
  return { todoMarkers: todoMarkers.slice(0, 200), todoCount: todoMarkers.length, fixmeCount: count(/fixme/), hackCount: count(/hack/), xxxCount: count(/xxx/) };
}

function detectPlaceholders(fileContents?: Record<string, string>): string[] {
  const out: string[] = [];
  for (const [path, content] of Object.entries(fileContents ?? {})) {
    if (/\.(ts|tsx|js|jsx|py|go|rs|rb|java|cs)$/.test(path)) {
      if (/not implemented|notimplemented|not_implemented|unimplemented|throw new Error\(["']Not implemented|return NotImplemented/i.test(content)) {
        out.push(`${path}: unimplemented path`);
      }
      if (/placeholder|lorem ipsum|todo: implement|fixme: implement/i.test(content)) {
        out.push(`${path}: placeholder`);
      }
    }
  }
  return [...new Set(out)];
}

function countCommentedOut(fileContents?: Record<string, string>): number {
  let count = 0;
  for (const [, content] of Object.entries(fileContents ?? {})) {
    if (content.includes("/*") && content.includes("*/")) count += (content.match(/\/\*/g) ?? []).length;
    if (/^\s*\/\/\s*(return|if|for|function|const|let)\b/m.test(content)) count += 1;
  }
  return count;
}

function detectMockData(fileTree: string[]): string[] {
  return fileTree.filter((p) => /mock|sample|fixture|seed|demo/i.test(p));
}

function detectDeadEnds(fileTree: string[]): string[] {
  return fileTree.filter((p) => {
    const base = (p.split("/").pop() ?? "").toLowerCase();
    return /(^|[._-])(old|v2|backup|unused|deprecated|scratch|wip|draft|copy|_bak|dead)/.test(base);
  });
}

function detectStubs(fileContents?: Record<string, string>): string[] {
  const out: string[] = [];
  for (const [path, content] of Object.entries(fileContents ?? {})) {
    if (/\.(ts|tsx|js|jsx|py|go|rs)$/.test(path)) {
      const emptyBody = /\bfunction\s+\w+\s*\([^)]*\)\s*\{\s*\}/g;
      const stubReturn = /\{\s*(return\s+(undefined|null|0|""|\[\]|\{\})\s*)?;\s*\}/;
      if (emptyBody.test(content) && stubReturn.test(content)) out.push(path);
    }
  }
  return out;
}

function missingEnvKeys(paths: string[], fileContents?: Record<string, string>): string[] {
  const envRefs = new Set<string>();
  for (const [, content] of Object.entries(fileContents ?? {})) {
    const m = content.matchAll(/(?:process\.env\.|env\s*\(\s*["'`]|getenv\(["'`])([A-Z0-9_]{3,})/g);
    for (const x of m) envRefs.add(x[1]);
  }
  const hasExample = paths.some((p) => /(^|\/)\.env\.(example|sample|template)$/.test(p) || /env\.example/.test(p));
  if (hasExample || envRefs.size === 0) return [];
  return [...envRefs].slice(0, 10);
}

function detectRuntimeRequires(paths: string[], packageJson?: string): string[] {
  const out = new Set<string>();
  if (packageJson) {
    const j = safeJson(packageJson) as { engines?: Record<string, string> } | null;
    if (j?.engines) {
      for (const [k, v] of Object.entries(j.engines)) out.add(`${k} ${v}`);
    }
  }
  if (paths.some((p) => /dockerfile/i.test(p))) out.add("container runtime");
  if (paths.some((p) => /\.env\.(example|sample)$/.test(p))) out.add("environment variables");
  return [...out];
}

function healthSignals(paths: string[], packageJson?: string): { conflicts: string[]; stale: string[]; failing: string[]; risks: string[] } {
  const conflicts: string[] = [];
  const stale: string[] = [];
  const risks: string[] = [];
  const failing: string[] = [];
  if (packageJson) {
    const { dependencies, devDependencies } = parseDeps(packageJson);
    const all = { ...dependencies, ...devDependencies };
    if (Object.keys(all).length === 0) risks.push("No runtime dependencies declared in package.json");
    const lock = paths.find((p) => /package-lock\.json|pnpm-lock|yarn\.lock|bun\.lock/.test(p));
    if (!lock && Object.keys(all).length > 0) {
      risks.push("Dependencies pinned but no lockfile committed (non-reproducible installs)");
    }
    for (const [name, range] of Object.entries(all)) {
      if (/^\^0\.|^\^1\.0$/.test(range)) stale.push(`${name}@${range} may be stale (major 0/1 pin)`);
    }
  }
  if (paths.some((p) => /node_modules\//.test(p))) risks.push("node_modules committed to the repo");
  if (paths.some((p) => /\.env$/i.test(p))) risks.push("A literal .env file is committed (secret exposure risk)");
  return { conflicts: conflicts.slice(0, 5), stale: stale.slice(0, 5), failing: failing.slice(0, 5), risks: risks.slice(0, 8) };
}

export function buildEvidence(input: ScanInput): RepoScanEvidence {
  const paths = input.fileTree;
  const contents = input.fileContents ?? {};
  const allPaths = paths.concat(Object.keys(contents));
  const lower = allPaths.map((p) => p.toLowerCase());
  const inAny = (needle: string) => lower.some((p) => p.includes(needle));
  const packageJson = Object.entries(contents).find(([p]) => /(^|\/)package\.json$/.test(p))?.[1];

  const tests = detectTests(allPaths);
  const markers = collectMarkers(contents);
  const health = healthSignals(allPaths, packageJson);
  const pkgManager = detectPackageManager(allPaths);
  const workspaces: string[] = [];
  if (packageJson) {
    const w = parseDeps(packageJson).workspaces;
    if (w) workspaces.push(...w);
  }
  if (inAny("pnpm-workspace.yaml")) workspaces.push("pnpm-workspace.yaml");
  if (inAny("lerna.json")) workspaces.push("lerna.json");
  const monorepo = inAny("turbo.json") || inAny("turborepo.json") || inAny("nx.json") || workspaces.length > 0 || MONOREPO_DIRS.some((d) => lower.some((p) => p.startsWith(d)));
  const sourceDirs = SRC_DIRS.filter((d) => allPaths.some((p) => p.startsWith(`${d}/`) || p === d));
  const ciFiles = allPaths.filter((p) => CI_FILES.some((c) => p.toLowerCase().includes(c.toLowerCase())));
  const deployFiles = allPaths.filter((p) => DEPLOY_FILES.some((c) => p.toLowerCase().includes(c.toLowerCase())));
  const migrationFiles = allPaths.filter((p) => MIGRATION_HINTS.some((c) => p.toLowerCase().includes(c)));
  const releaseFiles = allPaths.filter((p) => RELEASE_HINTS.some((c) => p.toLowerCase().includes(c.toLowerCase())));
  const envFiles = allPaths.filter((p) => ENV_HINTS.some((c) => p.toLowerCase().includes(c.toLowerCase())));
  const db = new Set<string>();
  const auth = new Set<string>();
  const api = new Set<string>();
  const frontend = new Set<string>();
  const backend = new Set<string>();
  const blob = packageJson ? packageJson.toLowerCase() : allPaths.join(" ").toLowerCase();
  const depNames = packageJson ? Object.keys(parseDeps(packageJson).dependencies) : [];
  const search = [...depNames, ...allPaths, ...(packageJson ? [packageJson] : [])].join(" ").toLowerCase();
  for (const h of DB_HINTS) if (search.includes(h.toLowerCase())) db.add(h.replace(/\\./g, ""));
  for (const h of AUTH_HINTS) if (search.includes(h.toLowerCase())) auth.add(h);
  for (const h of API_HINTS) if (search.includes(h.toLowerCase())) api.add(h);
  for (const h of FRONTEND_HINTS) if (search.includes(h.toLowerCase())) frontend.add(h);
  for (const h of BACKEND_HINTS) if (search.includes(h.toLowerCase())) backend.add(h);
  if (blob.includes("postgres") || blob.includes("pg")) db.add("Postgres");
  if (blob.includes("sqlite")) db.add("SQLite");

  const languages = detectLanguage(input.languageBytes ?? {}, allPaths);
  const missingEnv = missingEnvKeys(allPaths, contents);

  const summaryParts: string[] = [];
  summaryParts.push(`${allPaths.length} files${monorepo ? " (monorepo)" : ""}`);
  summaryParts.push(tests.has ? `${tests.files.length} test files` : "no tests detected");
  summaryParts.push(ciFiles.length ? "CI configured" : "no CI");
  summaryParts.push(deployFiles.length ? "deployment config present" : "no deployment config");
  summaryParts.push(markers.todoCount ? `${markers.todoCount} TODO/FIXME/HACK markers` : "no unfinished-work markers in scanned files");
  if (Object.keys(contents).length === 0 && paths.length > 0) summaryParts.push("scanned from structure only (file contents unavailable)");

  return {
    scanMode: Object.keys(contents).length > 0 ? "deep" : "shallow",
    structure: {
      fileCount: allPaths.length,
      fileTree: allPaths,
      directories: [...new Set(allPaths.map((p) => p.split("/").slice(0, -1).join("/")).filter(Boolean))],
      monorepo,
      workspaces,
      hasSource: sourceDirs.length > 0,
      sourceDirs,
      hasTests: tests.has,
      testFiles: tests.files.slice(0, 40),
      hasCi: ciFiles.length > 0,
      ciFiles: ciFiles.slice(0, 10),
      hasDeploy: deployFiles.length > 0,
      deployFiles: deployFiles.slice(0, 10),
      hasDocker: allPaths.some((p) => DOCKER_FILES.some((d) => p.toLowerCase().includes(d.toLowerCase()))),
      hasMigrations: migrationFiles.length > 0,
      migrationFiles: migrationFiles.slice(0, 10),
      hasReleaseConfig: releaseFiles.length > 0,
      releaseFiles: releaseFiles.slice(0, 10),
      hasEnvConfig: envFiles.length > 0,
    },
    runtime: {
      languages,
      languageBytes: input.languageBytes ?? {},
      frameworks: detectFrameworks(allPaths, packageJson),
      packageManager: pkgManager,
      buildSystem: buildSystem(allPaths, packageJson),
      database: [...db],
      auth: [...auth],
      api: [...api],
      frontend: [...frontend],
      backend: [...backend],
      engines: packageJson ? (safeJson(packageJson) as { engines?: string } | null)?.engines?.toString() ?? null : null,
      runtimeRequires: detectRuntimeRequires(allPaths, packageJson),
    },
    maturity: {
      testPresence: tests.has,
      testQuality: testQuality(tests.files, contents),
      ci: ciFiles.length > 0,
      deployment: deployFiles.length > 0,
      documentation: documentationQuality(input.readme),
      readmeLength: input.readme.length,
      hasEnvConfig: envFiles.length > 0,
      hasDocker: allPaths.some((p) => DOCKER_FILES.some((d) => p.toLowerCase().includes(d.toLowerCase()))),
      hasMigrations: migrationFiles.length > 0,
      hasRelease: releaseFiles.length > 0,
    },
    unfinished: {
      todoMarkers: markers.todoMarkers,
      todoCount: markers.todoCount,
      fixmeCount: markers.fixmeCount,
      hackCount: markers.hackCount,
      xxxCount: markers.xxxCount,
      placeholders: detectPlaceholders(contents),
      commentedOutBlocks: countCommentedOut(contents),
      stubs: detectStubs(contents),
      mockData: detectMockData(allPaths),
      deadEnds: detectDeadEnds(allPaths),
      incompleteDocs: documentationQuality(input.readme) === "none" || documentationQuality(input.readme) === "minimal" ? ["README is thin or absent"] : [],
    },
    health: {
      dependencyConflicts: health.conflicts,
      staleDeps: health.stale,
      missingEnvKeys: missingEnv,
      failingSignals: health.failing,
      risks: health.risks,
      buildStatus: "unknown",
      testStatus: tests.has ? "unknown" : "broken",
    },
    summary: summaryParts.join(" · "),
  };
}
