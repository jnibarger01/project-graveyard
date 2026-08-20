import assert from "node:assert/strict";
import { test } from "node:test";
import { buildEvidence, computeDecision, daysAgo, workToBucket, type PipelineRepo } from "../src/lib/scan/pipeline.ts";

function maturePrivate(): PipelineRepo {
  return {
    id: "m1",
    name: "delivery-dashboard",
    description: "Internal ops dashboard for tracking deliveries and incidents.",
    isPrivate: true,
    stars: 0,
    lastCommitAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    commitCount: 340,
    fileTree: [
      "package.json",
      "tsconfig.json",
      "README.md",
      "src/index.ts",
      "src/server.ts",
      "src/routes.ts",
      "src/db.ts",
      "src/middleware.ts",
      "src/utils/format.ts",
      "src/utils/http.ts",
      "src/features/deliveries.ts",
      "src/features/incidents.ts",
      "tests/deliveries.test.ts",
      "tests/incidents.test.ts",
      "tests/helpers.ts",
      ".github/workflows/ci.yml",
      "vercel.json",
      "migrations/0001_init.sql",
      "migrations/0002_status.sql",
      ".env.example",
      "Dockerfile",
    ],
    languages: { typescript: 20000, sql: 1200 },
    readme: "Delivery dashboard for internal ops. Tracks deliveries, incidents, and SLAs with a REST API and a small web UI.",
  };
}

const DECISION_RECS = ["FINISH", "ARCHIVE", "MERGE", "PRODUCTIZE", "OPEN_SOURCE", "UNKNOWN"] as const;

test("mature deployed private project: positive, non-destructive recommendation and high readiness", () => {
  const ctx = computeDecision(maturePrivate(), []);
  const rec = ctx.decision.recommendation;
  assert.ok(rec !== "ARCHIVE" && rec !== "MERGE" && rec !== "UNKNOWN", `got ${rec}`);
  assert.ok(ctx.decision.readiness.readiness >= 55, `readiness ${ctx.decision.readiness.readiness}`);
  assert.ok(ctx.decision.evidence.length > 0);
  // productization honesty: without market research, demand is an unverified unknown
  if (rec === "PRODUCTIZE") {
    assert.ok(ctx.decision.productization && !ctx.decision.productization.marketResearched);
    assert.ok(ctx.decision.knownUnknowns.some((k) => /market|demand/i.test(k)));
  }
});

test("has tests but failing build: flags build/test health, never claims build is ok", () => {
  const evidence = buildEvidence({
    fileTree: [
      "package.json",
      "src/index.ts",
      "tests/app.test.ts",
      "tests/util.test.ts",
      "README.md",
      ".github/workflows/ci.yml",
    ],
    readme: "Full stack todo app with auth, sync, and a web client.",
    fileContents: {},
  });
  evidence.health.buildStatus = "broken";
  evidence.health.testStatus = "broken";
  evidence.health.failingSignals.push("npm run build exits nonzero (missing ./dist output)");
  evidence.health.risks.push("Compile error in src/index.ts blocks a production build");
  const repo: PipelineRepo = { ...maturePrivate(), id: "fb", name: "todo-app", fileTree: evidence.structure.fileTree, evidence };
  const ctx = computeDecision(repo, []);
  assert.notEqual(ctx.decision.recommendation, "ARCHIVE");
  assert.ok(
    ctx.decision.risks.some((r) => /build|compile/i.test(r)) || ctx.decision.blockers.some((b) => /build|compile/i.test(b)),
    "expected a build/compile blocker or risk",
  );
  assert.equal(evidence.health.buildStatus, "broken");
});

test("no tests but otherwise complete: blockers call out the missing suite", () => {
  const evidence = buildEvidence({
    fileTree: [
      "package.json",
      "src/index.ts",
      "src/api.ts",
      "README.md",
      "vercel.json",
      "migrations/0001_init.sql",
      ".github/workflows/ci.yml",
    ],
    readme: "Public API service with auth, payments, and webhooks.",
    fileContents: {},
  });
  assert.equal(evidence.maturity.testPresence, false);
  const repo: PipelineRepo = { ...maturePrivate(), id: "nt", name: "pay-api", evidence };
  const ctx = computeDecision(repo, []);
  if (ctx.decision.recommendation !== "ARCHIVE") {
    assert.ok(ctx.decision.blockers.some((b) => /test/i.test(b)), "expected a no-test-suite blocker");
  }
});

test("nearly empty stale repository: ARCHIVE", () => {
  const repo: PipelineRepo = {
    id: "ne",
    name: "scratch-notes",
    description: "random python doodles",
    isPrivate: true,
    stars: 0,
    lastCommitAt: new Date(Date.now() - 500 * 86_400_000).toISOString(),
    commitCount: 5,
    fileTree: ["notes.py", "README.md", ".gitignore"],
  };
  const ctx = computeDecision(repo, []);
  assert.equal(ctx.decision.recommendation, "ARCHIVE");
});

test("monorepo: detected as workspace with source and tests", () => {
  const evidence = buildEvidence({
    fileTree: [
      "pnpm-workspace.yaml",
      "package.json",
      "packages/core/src/index.ts",
      "packages/core/tests/core.test.ts",
      "packages/api/src/server.ts",
      "packages/api/tests/api.test.ts",
      "packages/web/src/app.tsx",
      "README.md",
    ],
    readme: "Monorepo for the platform: core, api, and web.",
    fileContents: {},
  });
  assert.equal(evidence.structure.monorepo, true);
  assert.ok(evidence.structure.workspaces.length >= 1, "workspace marker detected");
  assert.equal(evidence.maturity.testPresence, true);
});

test("TODO/FIXME markers: captured in unfinished evidence", () => {
  const evidence = buildEvidence({
    fileTree: ["src/index.ts", "src/auth.ts", "README.md", "package.json"],
    readme: "Auth service.",
    fileContents: {
      "src/index.ts": "// TODO: add retry logic\nconst x = 1;\n// FIXME: memory leak here\n",
      "src/auth.ts": "function login() { throw new Error('not implemented'); }\n",
    },
  });
  assert.ok(evidence.unfinished.todoCount >= 1, `todoCount=${evidence.unfinished.todoCount}`);
  assert.ok(evidence.unfinished.todoMarkers.some((t) => /retry/i.test(t.text)));
});

test("README claims unimplemented functionality: stubs/placeholders are evidence", () => {
  const evidence = buildEvidence({
    fileTree: ["src/main.py", "src/analyzer.py", "README.md"],
    readme: "Analyzer supports PDF ingestion, OCR, vector search, and Slack notifications.",
    fileContents: {
      "src/analyzer.py": "def ocr(path):\n    raise NotImplementedError\n\ndef vectorize(doc):\n    pass  # TODO\n",
      "src/main.py": "def send_slack():\n    print('stub')\n",
    },
  });
  assert.ok(evidence.unfinished.placeholders.length > 0, "expected an unimplemented/placeholder path");
  assert.ok(evidence.unfinished.todoCount > 0);
});

test("duplicate/overlapping projects: high conceptual overlap and shared functionality", () => {
  const a: PipelineRepo = {
    id: "a",
    name: "todo-app",
    description: "Personal todo list with tags and reminders.",
    isPrivate: true,
    stars: 0,
    lastCommitAt: new Date().toISOString(),
    commitCount: 60,
    fileTree: ["package.json", "src/index.ts", "src/todos.ts", "tests/todos.test.ts", "README.md"],
    readme: "Todo app with tags, priorities, and reminders.",
  };
  const b: PipelineRepo = {
    id: "b",
    name: "task-tracker",
    description: "Task manager with tags, priorities, and notifications.",
    isPrivate: true,
    stars: 0,
    lastCommitAt: new Date().toISOString(),
    commitCount: 30,
    fileTree: ["package.json", "src/index.ts", "src/tasks.ts", "tests/tasks.test.ts", "README.md"],
    readme: "Task tracker with tags, priorities, and reminders.",
  };
  const ctx = computeDecision(a, [b]);
  const top = ctx.overlaps[0];
  assert.ok(top, "expected an overlap");
  assert.ok(top.conceptualOverlap >= 30, `overlap ${top.conceptualOverlap}`);
  assert.ok(ctx.legacyOverlaps.length >= 1);
});

test("insufficient evidence (shallow empty scan): UNKNOWN with low confidence", () => {
  const evidence = buildEvidence({ fileTree: [], readme: "", fileContents: {} });
  evidence.scanMode = "shallow";
  const repo: PipelineRepo = {
    id: "ie",
    name: "mystery-repo",
    description: "",
    isPrivate: true,
    stars: 0,
    lastCommitAt: new Date().toISOString(),
    commitCount: 0,
    evidence,
  };
  const ctx = computeDecision(repo, []);
  assert.equal(ctx.decision.recommendation, "UNKNOWN");
  assert.equal(ctx.decision.recommendationConfidence, "low");
  assert.ok(ctx.decision.knownUnknowns.length > 0);
});

test("workToBucket buckets the estimate sensibly", () => {
  assert.equal(workToBucket({ rangeHoursLow: 1, rangeHoursHigh: 3, rangeLabel: "1–3 hours", confidence: "medium", factors: [], unknowns: [], reasoning: "" }), "tiny");
  assert.equal(workToBucket({ rangeHoursLow: 40, rangeHoursHigh: 80, rangeLabel: "5–10 days", confidence: "low", factors: [], unknowns: [], reasoning: "" }), "massive");
});

test("daysAgo handles invalid dates gracefully", () => {
  assert.equal(daysAgo("not-a-date"), 9999);
  assert.equal(daysAgo(new Date().toISOString()), 0);
});

test("recommendation codes stay within the known set", () => {
  const samples = [
    maturePrivate(),
    { ...maturePrivate(), id: "e", name: "tiny", fileTree: ["a.py"], commitCount: 2, lastCommitAt: new Date(Date.now() - 900 * 86_400_000).toISOString() },
  ];
  for (const s of samples) {
    const rec = computeDecision(s, []).decision.recommendation;
    assert.ok((DECISION_RECS as readonly string[]).includes(rec), `unexpected ${rec}`);
  }
});