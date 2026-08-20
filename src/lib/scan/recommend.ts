import { estimateWork } from "./estimate.ts";
import { scoreReadiness } from "./readiness.ts";
import type {
  Confidence,
  EvidenceItem,
  FirstAction,
  OverlapResult,
  ProductizationAssessment,
  ProjectDecision,
  RecommendationCode,
  RepoScanEvidence,
} from "./types.ts";

export interface RecommendationInputs {
  repo: {
    id: string;
    name: string;
    description: string;
    isPrivate: boolean;
    isPublic: boolean;
    stars: number;
    lastCommitDaysAgo: number;
    commitCount: number;
  };
  evidence: RepoScanEvidence;
  overlaps: OverlapResult[];
  personalValue: number; // 0..100 caller-estimated personal usefulness
  productization?: ProductizationAssessment;
}

function ev(id: string, kind: EvidenceItem["kind"], claim: string, detail?: string): EvidenceItem {
  return { id, category: "recommendation", kind, claim, detail };
}

function confidenceFor(evidence: RepoScanEvidence, signals: number): Confidence {
  if (evidence.scanMode === "shallow") return "low";
  if (evidence.structure.fileCount < 5) return "low";
  if (signals >= 4) return "high";
  return "medium";
}

const RECOMMENDATION_ACTIONS: Record<Exclude<RecommendationCode, "UNKNOWN">, { verb: string; done: string }> = {
  FINISH: { verb: "Push the remaining work to a usable state", done: "A fresh clone builds, runs, and passes the project's own checks." },
  ARCHIVE: { verb: "Archive the repository and preserve any unique notes", done: "Repository is archived and unique content is recorded in a note or another repo." },
  MERGE: { verb: "Merge the keepable pieces into the target project, then archive", done: "Keepable code is in the target; this repo is archived." },
  PRODUCTIZE: { verb: "Validate the market before investing further", done: "One paying user (or signed letter of intent) using the current build." },
  OPEN_SOURCE: { verb: "Package it for release: docs, license, contribution guide", done: "Tagged release with a contribution guide and CI publishing the artifact." },
};

function firstActionFor(rec: RecommendationCode, input: RecommendationInputs): FirstAction {
  if (rec === "UNKNOWN") {
    return {
      title: "Gather more evidence",
      description: "The scan lacks enough signal to recommend a fate. Inspect the repository manually or connect a deeper scan.",
      definitionOfDone: "Either enough evidence to issue a confident recommendation, or an explicit manual decision.",
    };
  }
  const meta = RECOMMENDATION_ACTIONS[rec];
  const topTodo = input.evidence.unfinished.todoMarkers[0];
  const details: Record<Exclude<RecommendationCode, "UNKNOWN">, string> = {
    FINISH: `Start with the concrete remaining work (${input.evidence.unfinished.todoCount} markers${topTodo ? `, e.g. ${topTodo.file}:${topTodo.line}` : ""}) and the missing pieces flagged in the readiness breakdown.`,
    ARCHIVE: "Write a short hand-off note (why it existed, what is worth keeping), then archive on GitHub. No code changes required.",
    MERGE: `Identify which files to lift into ${input.overlaps[0]?.otherName ?? "the target repo"}, copy them over, and delete the duplicates here.`,
    PRODUCTIZE: "Run the productization checks first: confirm a target user and a willingness to pay before writing more code.",
    OPEN_SOURCE: "Freeze the public API, add CONTRIBUTING and a LICENSE, then tag a release.",
  };
  return {
    title: `${meta.verb}`,
    description: details[rec],
    definitionOfDone: meta.done,
  };
}

export function recommend(input: RecommendationInputs): ProjectDecision {
  const readiness = scoreReadiness(input.evidence);
  const remaining = estimateWork(input.evidence, readiness);
  const evidence = [...readiness.evidence];
  const blockers: string[] = [];
  const risks: string[] = [];
  const unknown: string[] = [];
  const u = input.evidence.unfinished;
  const m = input.evidence.maturity;
  const h = input.evidence.health;

  let rec: RecommendationCode;
  let confidence: Confidence;
  let summary: string;

  const signals = [
    input.evidence.structure.hasTests,
    input.evidence.structure.hasCi,
    input.evidence.structure.hasDeploy,
    input.evidence.structure.hasSource,
    input.evidence.structure.hasMigrations,
    u.todoCount > 0,
  ].filter(Boolean).length;

  const topOverlap = input.overlaps[0];
  const isStale = input.repo.lastCommitDaysAgo > 400;
  const nearlyEmpty = input.evidence.structure.fileCount <= 3 && input.repo.commitCount < 12;

  if (input.evidence.scanMode === "shallow" && input.evidence.structure.fileCount === 0) {
    rec = "UNKNOWN";
    confidence = "low";
    summary = "No files were visible to the scanner — cannot recommend a fate from structure alone.";
    unknown.push("Repository contents could not be inspected.");
    return {
      recommendation: rec,
      recommendationConfidence: confidence,
      summary,
      evidence,
      readiness,
      blockers,
      risks: [...risks, ...h.risks],
      remainingWork: remaining,
      firstAction: firstActionFor(rec, input),
      knownUnknowns: unknown,
source: input.evidence.scanMode === ("deep" as string) ? "deep-scan" : "shallow-scan",
      productization: input.productization,
    };
  }

  if (topOverlap && topOverlap.conceptualOverlap >= 60 && readiness.readiness < 55 && topOverlap.confidence !== "low") {
    rec = "MERGE";
    confidence = topOverlap.confidence;
    summary = `${input.repo.name} shares ${topOverlap.conceptualOverlap}% conceptual scope with ${topOverlap.otherName} and is the less complete of the two.`;
    evidence.push(ev("merge-overlap", "negative", `High conceptual overlap with ${topOverlap.otherName}`, `${topOverlap.conceptualOverlap}%`));
    evidence.push(...topOverlap.sharedFunctionality.slice(0, 3).map((f, i) => ev(`merge-shared-${i}`, "neutral", `Shared functionality: ${f}`)));
    blockers.push(`Consolidate into ${topOverlap.otherName} first; do not maintain two codebases.`);
    risks.push("Both repositories may drift further if left unmerged.");
  } else if (nearlyEmpty && isStale) {
    rec = "ARCHIVE";
    confidence = confidenceFor(input.evidence, signals);
    summary = "Nearly empty and untouched for over a year — this is a dead end, not a project.";
    evidence.push(ev("archive-empty", "negative", "Repository is nearly empty", `${input.evidence.structure.fileCount} files`));
    evidence.push(ev("archive-stale", "negative", `No meaningful activity in ${input.repo.lastCommitDaysAgo} days`));
    blockers.push("Nothing concrete to finish — the remaining work is not bounded.");
  } else if (isStale && readiness.readiness < 40 && input.personalValue < 35) {
    rec = "ARCHIVE";
    confidence = confidenceFor(input.evidence, signals);
    summary = "Stale, low-readiness, and low personal value. Archiving is cheaper than a guilt rewrite.";
    evidence.push(ev("archive-stale2", "negative", `No meaningful activity in ${input.repo.lastCommitDaysAgo} days`));
    evidence.push(ev("archive-readiness", "negative", `Execution readiness is only ${readiness.readiness}/100`));
    if (!m.testPresence) evidence.push(ev("archive-notest", "negative", "No test suite to protect work done so far"));
    blockers.push("No committed roadmap; resuming requires re-deriving intent from scratch.");
  } else if (
    input.productization &&
    input.productization.technicalReadiness >= 55 &&
    input.productization.problemClarity >= 55 &&
    readiness.readiness >= 45
  ) {
    rec = "PRODUCTIZE";
    confidence = input.productization.marketResearched ? "high" : "medium";
    summary = "The technical foundation supports a product, but market claims are unverified — validate before investing.";
    evidence.push(ev("prod-tech", "positive", `Technical readiness for a product: ${input.productization.technicalReadiness}/100`));
    evidence.push(ev("prod-problem", "positive", `Problem clarity: ${input.productization.problemClarity}/100`));
    if (!input.productization.marketResearched) {
      evidence.push(ev("prod-market", "neutral", "Market/demand has NOT been researched — do not assume revenue"));
      unknown.push("Demand, willingness to pay, and competitors are unverified.");
      risks.push("Productizing without market validation risks months of work on an assumption.");
    } else {
      evidence.push(ev("prod-market-ok", "positive", "Market evidence was researched"));
    }
    blockers.push("Confirm a target user will pay before adding more features.");
    blockers.push("Resolve technical blockers flagged in the readiness breakdown.");
  } else if (!input.repo.isPrivate && readiness.readiness >= 55 && m.documentation !== "none" && m.testPresence) {
    rec = "OPEN_SOURCE";
    confidence = confidenceFor(input.evidence, signals);
    summary = "Already public, reasonably documented, and tested. The remaining work is packaging, not product.";
    evidence.push(ev("oss-public", "positive", "Repository is public"));
    evidence.push(ev("oss-docs", "positive", "Documentation present"));
    evidence.push(ev("oss-tests", "positive", "Tests present"));
    risks.push("Without a contribution guide and license, the repo stays a personal scratchpad.");
  } else if (isStale && readiness.readiness >= 60) {
    rec = "FINISH";
    confidence = "low";
    summary = "Stale but substantial. A focused finish (not a rewrite) is viable, but confidence is low without recent activity to verify.";
    evidence.push(ev("finish-stale", "neutral", `Last meaningful activity ${input.repo.lastCommitDaysAgo} days ago — verify current state before committing to a finish`));
    unknown.push("Current build/test status is unknown without executing the project.");
  } else if (readiness.readiness >= 30 && input.personalValue >= 30) {
    rec = "FINISH";
    confidence = confidenceFor(input.evidence, signals);
    summary = "The remaining work is bounded and the project has enough substance to be worth finishing.";
    evidence.push(ev("finish-substance", "positive", "Repository has real substance", `${input.evidence.structure.fileCount} files, ${input.repo.commitCount} commits`));
    if (readiness.readiness >= 75) evidence.push(ev("finish-close", "positive", `Execution readiness is high (${readiness.readiness}/100) — close to done`));
  } else {
    rec = "UNKNOWN";
    confidence = "low";
    summary = "Evidence is insufficient to recommend a fate with confidence. Inspect the repository manually.";
    unknown.push("Too few positive or negative signals to decide between finish/archive/merge.");
  }

  // Common risk and blocker enrichment (only what the scan actually observed).
  if (h.risks.length > 0) risks.push(...h.risks.slice(0, 2));
  if (u.todoCount > 15) blockers.push(`${u.todoCount} TODO/FIXME markers — triage before building`);
  if (u.stubs.length > 0) blockers.push(`${u.stubs.length} stub functions that mask incomplete behavior`);
  if (!m.testPresence && rec !== "ARCHIVE") blockers.push("No test suite — hard to finish without regressions");
  if (h.missingEnvKeys.length > 0) risks.push(`${h.missingEnvKeys.length} env vars referenced without an example file`);
  if (m.testPresence && h.testStatus === "unknown") unknown.push("Tests exist but have not been executed by the scanner.");

  return {
    recommendation: rec,
    recommendationConfidence: confidence,
    summary,
    evidence,
    readiness,
    blockers: [...new Set(blockers)].slice(0, 6),
    risks: [...new Set(risks)].slice(0, 6),
    remainingWork: remaining,
    firstAction: firstActionFor(rec, input),
    knownUnknowns: [...new Set(unknown)].slice(0, 6),
    source: input.evidence.scanMode === "deep" ? "deep-scan" : "shallow-scan",
    productization: input.productization,
  };
}