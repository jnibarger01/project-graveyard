import { clamp } from "./utils";
import {
  computeDecision,
  daysAgo,
  estimatePersonalValue,
  repoEvidence,
  workToBucket,
  type PipelineRepo,
} from "./scan/pipeline.ts";
import type {
  Analysis,
  Milestone,
  Overlap,
  ProjectState,
  Recommendation,
  RemainingTask,
  Repo,
  RepoScanEvidence,
} from "./types";
import type { ProjectDecision } from "./scan/types.ts";

export type RepoSignals = Omit<Repo, "analysis" | "userStatus" | "userNotes" | "queuePosition"> & {
  readmeExcerpt?: string;
};

const EPITAPHS = [
  "Technically only needed one more weekend.",
  "Killed by authentication.",
  "Here lies another rewrite.",
  "Replaced by a newer project doing almost exactly the same thing.",
  "Paused for a refactor that never landed.",
  "Died on the one-yard line.",
  "Forgot it existed.",
  "Killed by scope.",
  "Waiting for a perfect importer.",
  "Outrun by the thing it was measuring.",
];

const SCANNER_VERSION = "2.0.0";

function pickEpitaph(s: RepoSignals, rec: Recommendation, cause: string) {
  if (rec === "MERGE") return "Replaced by a newer project doing almost exactly the same thing.";
  if (cause.toLowerCase().includes("auth")) return "Killed by authentication.";
  if (cause.toLowerCase().includes("rewrite")) return "Here lies another rewrite.";
  if (s.commitCount < 15) return "Forgot it existed.";
  const idx = Math.abs(s.name.length + s.commitCount) % EPITAPHS.length;
  return EPITAPHS[idx] ?? EPITAPHS[0];
}

function causeOfDeath(s: RepoSignals, readiness: number) {
  const age = daysAgo(s.lastCommitAt);
  if (readiness >= 85) return "None — still running.";
  if (s.todoCount > 18 && s.hasAuth === false && /dash|app|saas/i.test(s.name + s.description))
    return "Killed by authentication.";
  if (s.branchCount >= 5) return "Started rewriting the frontend.";
  if (age > 400) return "Forgot it existed.";
  if (!s.hasTests && s.commitCount > 40) return "Paused when tests were 'next.'";
  if (!s.hasDeploy && s.hasDb) return "Got useful locally, never deployed.";
  return "Attention moved to a newer repo.";
}

function currentStateFrom(readiness: number, age: number, hasTests: boolean, commits: number): ProjectState {
  if (readiness >= 85 && hasTests && (age < 60 || readiness >= 92)) return "production";
  if (age > 540 && readiness < 50) return "abandoned";
  if (age > 400 && readiness < 35) return "abandoned";
  if (commits < 12 && readiness < 30) return "idea";
  if (age > 500 && readiness >= 60) return "legacy";
  if (readiness >= 75) return "mostly_complete";
  if (readiness >= 48) return "mvp";
  if (readiness < 35) return "early";
  if (age > 300) return "legacy";
  return "unknown";
}

function mapRec(code: string): Recommendation {
  const allowed: Recommendation[] = ["FINISH", "ARCHIVE", "MERGE", "PRODUCTIZE", "OPEN_SOURCE", "UNKNOWN"];
  return (allowed as string[]).includes(code) ? (code as Recommendation) : "UNKNOWN";
}

function whatsMissing(evidence: RepoScanEvidence): string[] {
  const out: string[] = [];
  const m = evidence.maturity;
  const r = evidence.runtime;
  if (!m.testPresence) out.push("Testing");
  if (!m.ci) out.push("CI/CD");
  if (!m.deployment) out.push("Deployment");
  if (m.documentation === "none" || m.documentation === "minimal") out.push("Documentation");
  if (!m.hasEnvConfig && evidence.health.missingEnvKeys.length > 0) out.push("Environment configuration");
  if (m.hasMigrations === false && r.database.length > 0) out.push("Migrations");
  if (evidence.unfinished.todoCount > 12) out.push("Core functionality");
  if (r.frameworks.some((f) => /react|vue|svelte/i.test(f)) && m.documentation === "minimal") out.push("UI/UX");
  return [...new Set(out)].slice(0, 6);
}

function toPipelineRepo(s: RepoSignals): PipelineRepo {
  return {
    id: s.id,
    name: s.name,
    description: s.description,
    isPrivate: s.isPrivate,
    stars: s.stars,
    lastCommitAt: s.lastCommitAt,
    commitCount: s.commitCount,
    fileTree: s.fileTree ?? [],
    languages: s.languages,
    readme: s.readmeExcerpt ?? "",
    evidence: s.scanEvidence,
  };
}

export function analyzeRepo(s: RepoSignals, others: RepoSignals[] = []): Analysis {
  const repo = toPipelineRepo(s);
  const { decision, overlaps: semanticOverlaps, legacyOverlaps } = computeDecision(repo, others.map(toPipelineRepo));
  const evidence = repoEvidence(repo);
  const readiness = decision.readiness.readiness;
  const age = daysAgo(s.lastCommitAt);
  const state = currentStateFrom(readiness, age, s.hasTests, s.commitCount);
  const work = workToBucket(decision.remainingWork);
  const missing = whatsMissing(evidence);
  const cause = causeOfDeath(s, readiness);
  const personal = estimatePersonalValue(repo, evidence, readiness);

  const complexity = clamp(Math.round(1 + Math.min(4, evidence.runtime.frameworks.length) / 2 + (evidence.runtime.database.length > 0 ? 1 : 0) + (s.sizeKb > 8000 ? 1 : 0)), 1, 5);
  const maintenance = clamp(Math.round(20 + complexity * 12 + (s.openIssues + decision.readiness.evidence.length) * 1.2 + (s.branchCount > 4 ? 8 : 0)), 5, 95);
  const portfolioValue = clamp(Math.round((evidence.maturity.readmeLength > 400 ? 15 : 0) + (readiness + personal) / 2 + (s.stars > 5 ? 8 : 0) + (s.hasTests ? 6 : 0)), 0, 95);
  const ossValue = clamp(Math.round((s.isPrivate ? 15 : 55) + s.stars * 2 + (evidence.maturity.documentation !== "none" ? 20 : 0) + (s.hasTests ? 8 : 0)), 0, 96);
  const commercialPotential = decision.productization?.technicalReadiness ?? clamp(Math.round((s.hasAuth ? 14 : 0) + (s.hasDb ? 14 : 0) + (s.hasDeploy ? 10 : 0) + readiness * 0.35), 0, 95);
  const learningValue = clamp(Math.round(30 + evidence.runtime.frameworks.length * 6 + (evidence.unfinished.todoCount > 10 ? 8 : 0)), 0, 90);

  const resurrectionScore = clamp(
    Math.round(
      ({ tiny: 92, small: 78, medium: 58, large: 36, massive: 16 }[work] ?? 50) * 0.18 +
        commercialPotential * 0.18 +
        personal * 0.22 +
        readiness * 0.16 +
        portfolioValue * 0.14 +
        clamp(100 - age / 4, 8, 95) * 0.12,
    ),
    1,
    98,
  );
  let finalResurrection = resurrectionScore;
  if (decision.recommendation === "ARCHIVE") finalResurrection = Math.min(resurrectionScore, 32);
  if (decision.recommendation === "MERGE") finalResurrection = Math.min(resurrectionScore, 45);
  if (decision.recommendation === "PRODUCTIZE") finalResurrection = Math.max(resurrectionScore, 70);

  const tasks: RemainingTask[] = decision.remainingWork.factors.slice(0, 5).map((f, i) => ({
    id: `t${i + 1}`,
    title: f,
    estimate: i === 0 ? (work === "massive" ? "medium" : "small") : "small",
  }));
  if (tasks.length === 0) tasks.push({ id: "t1", title: "Verify the current build and run", estimate: "tiny" });
  const milestones: Milestone[] = missing.slice(0, 4).map((m, i) => ({ id: `ms${i + 1}`, title: m, done: false }));

  const rec = mapRec(decision.recommendation);
  const reason = decision.summary;

  return {
    purpose: s.description?.trim() || decision.summary || `A ${s.language || "software"} project named ${s.name}. Insufficient README to infer a sharper purpose.`,
    currentState: state,
    whatsMissing: missing.length ? missing : ["Verify"],
    recommendation: rec,
    recommendationReason: reason,
    workRemaining: work,
    workTasks: decision.remainingWork.factors.slice(0, 5),
    completionPct: readiness,
    complexity,
    maintenanceBurden: maintenance,
    usefulness: personal,
    commercialPotential,
    ossPotential: ossValue,
    personalUsefulness: personal,
    portfolioValue,
    ossValue,
    learningValue,
    resurrectionScore: finalResurrection,
    epitaph: pickEpitaph(s, rec, cause),
    causeOfDeath: cause,
    bornDate: s.createdAtGh.slice(0, 10),
    overlaps: legacyOverlaps,
    facts: [
      `${s.commitCount} commits, last push ${s.lastCommitAt.slice(0, 10)}`,
      `${s.isPrivate ? "Private" : "Public"} · ${s.language || "unknown language"}`,
      `Readiness ${readiness}/100 (${decision.readiness.confidence})`,
      `Tests ${evidence.maturity.testPresence ? "present" : "absent"}, CI ${evidence.maturity.ci ? "present" : "absent"}, deploy ${evidence.maturity.deployment ? "present" : "absent"}`,
      `${evidence.unfinished.todoCount} TODO/FIXME · ${s.openIssues} open issues · ${s.branchCount} branches`,
    ],
    assumptions: [
      decision.readiness.confidence === "low" ? "Scanned from structure only — content-based signals are unverified." : "Signals were derived from repository contents, not executed.",
      decision.productization?.marketResearched === false ? "Product/market claims are unverified — do not assume revenue." : "Recommendation is evidence-based.",
    ],
    mvpDefinition: `A usable ${s.name} that covers the README's stated purpose without expanding scope.`,
    milestones,
    taskList: tasks,
    firstTask: decision.firstAction.title,
    dependencies: semanticOverlaps.filter((o) => o.conceptualOverlap >= 60).map((o) => o.otherName) ?? [],
    blockers: decision.blockers,
    definitionOfDone: decision.firstAction.definitionOfDone,
    analyzedAt: new Date().toISOString(),
    source: "heuristic",
    readiness,
    readinessConfidence: decision.readiness.confidence,
    readinessBreakdown: decision.readiness.factors,
    evidence: decision.evidence,
    risks: decision.risks,
    recommendationConfidence: decision.recommendationConfidence,
    knownUnknowns: decision.knownUnknowns,
    remainingWork: decision.remainingWork,
    firstAction: decision.firstAction,
    productization: decision.productization,
    semanticOverlaps,
    scan: evidence,
    scannerVersion: SCANNER_VERSION,
  };
}

/** Shallow, Jaccard-style overlap for callers that only have metadata. */
export function detectOverlaps(current: RepoSignals, others: RepoSignals[]): Overlap[] {
  const a = toPipelineRepo(current);
  const { overlaps } = computeDecision(a, others.map(toPipelineRepo));
  return overlaps
    ? overlaps.filter((o) => o.conceptualOverlap >= 28).map((o) => ({
        repoId: o.otherRepoId,
        name: o.otherName,
        percent: o.conceptualOverlap,
        note: o.recommendation,
      }))
    : [];
}

export function toSignals(repo: Repo): RepoSignals {
  const { analysis: _a, userStatus: _u, userNotes: _n, queuePosition: _q, ...rest } = repo;
  return rest;
}

/**
 * Merge the evidence-backed decision fields from a freshly computed analysis
 * into an existing analysis, preserving any hand-authored narrative. Lets demo
 * and previously-persisted analyses gain readiness/evidence without a rewrite.
 */
export function enrichAnalysisWithEvidence(existing: Analysis, computed: Analysis): Analysis {
  if (existing.readiness !== undefined && existing.evidence) return existing;
  return {
    ...existing,
    readiness: computed.readiness,
    readinessConfidence: computed.readinessConfidence,
    readinessBreakdown: computed.readinessBreakdown,
    evidence: computed.evidence,
    risks: computed.risks,
    recommendationConfidence: computed.recommendationConfidence,
    knownUnknowns: computed.knownUnknowns,
    remainingWork: computed.remainingWork,
    firstAction: computed.firstAction,
    productization: computed.productization,
    semanticOverlaps: computed.semanticOverlaps,
    scan: computed.scan,
    scannerVersion: computed.scannerVersion,
  };
}

/** Recompute the evidence fields for a repo (client-safe, deterministic). */
export function recomputeEvidence(repo: Repo, others: Repo[]): Analysis {
  const computed = analyzeRepo(toSignals(repo), others.map(toSignals));
  return enrichAnalysisWithEvidence(repo.analysis, computed);
}

/**
 * Build a scan-layer ProjectDecision from a stored, possibly AI-refined
 * Analysis, so downstream consumers (e.g. the "tonight" ranking) run on the
 * same verdict the user actually saw — not a fresh deterministic recompute.
 */
export function toDecision(repo: Repo): ProjectDecision {
  const a = repo.analysis;
  return {
    recommendation: mapRec(a.recommendation),
    recommendationConfidence: a.recommendationConfidence ?? "low",
    summary: a.advisorySummary ?? a.recommendationReason,
    evidence: a.evidence ?? [],
    readiness: {
      readiness: a.readiness ?? a.completionPct,
      confidence: a.readinessConfidence ?? "low",
      factors: a.readinessBreakdown ?? [],
      evidence: a.evidence ?? [],
    },
    blockers: a.blockers,
    risks: a.risks ?? [],
    remainingWork:
      a.remainingWork ??
      ({
        rangeHoursLow: 2,
        rangeHoursHigh: 6,
        rangeLabel: "2–6 hours",
        confidence: "low",
        factors: [],
        unknowns: [],
        reasoning: "No structured estimate available.",
      } as const),
    firstAction:
      a.firstAction ?? {
        title: a.firstTask ?? "Verify the current build",
        description: a.firstTask ?? "Confirm the project builds and runs before doing anything else.",
        definitionOfDone: a.definitionOfDone ?? "A fresh clone builds, runs, and passes the project's own checks.",
      },
    knownUnknowns: a.knownUnknowns ?? [],
    source: a.source === "llm" ? "ai" : a.readinessConfidence === "low" ? "shallow-scan" : "deep-scan",
    productization: a.productization,
  };
}