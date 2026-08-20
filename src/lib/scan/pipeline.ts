import { buildEvidence } from "./evidence.ts";
import { estimateWork, rangeLabel } from "./estimate.ts";
import { assessProductization } from "./productize.ts";
import { scoreReadiness } from "./readiness.ts";
import { recommend, type RecommendationInputs } from "./recommend.ts";
import { compareProjects, type OverlapProject } from "./semantic.ts";
import type {
  OverlapResult,
  ProjectDecision,
  RepoScanEvidence,
  WorkEstimate,
} from "./types.ts";

/** Minimal repo view the pipeline needs. */
export interface PipelineRepo {
  id: string;
  name: string;
  description: string;
  isPrivate: boolean;
  stars: number;
  lastCommitAt: string;
  commitCount: number;
  fileTree: string[];
  languages?: Record<string, number>;
  readme?: string;
  evidence?: RepoScanEvidence;
}

export function daysAgo(iso: string): number {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 9999;
  return Math.max(0, Math.round((Date.now() - t) / 86_400_000));
}

export function repoEvidence(repo: PipelineRepo, languageBytes?: Record<string, number>): RepoScanEvidence {
  if (repo.evidence) return repo.evidence;
  return buildEvidence({
    fileTree: repo.fileTree ?? [],
    readme: repo.readme ?? "",
    fileContents: {},
    languageBytes: languageBytes ?? repo.languages,
  });
}

export interface PipelineOptions {
  personalValue?: number;
}

export interface DecisionContext {
  decision: ProjectDecision;
  overlaps: OverlapResult[];
  /** shallow/jaccard-style legacy overlaps (kept for the old UI). */
  legacyOverlaps: { repoId: string; name: string; percent: number; note: string }[];
}

export function computeDecision(repo: PipelineRepo, others: PipelineRepo[], options: PipelineOptions = {}): DecisionContext {
  const evidence = repoEvidence(repo);
  const readiness = scoreReadiness(evidence);

  // Semantic overlaps against others.
  const me: OverlapProject = {
    id: repo.id,
    name: repo.name,
    description: repo.description,
    readme: repo.readme,
    evidence,
  };
  const overlapResults: OverlapResult[] = [];
  const legacyOverlaps: DecisionContext["legacyOverlaps"] = [];
  for (const other of others) {
    if (other.id === repo.id) continue;
    const otherEvidence = repoEvidence(other);
    const res = compareProjects(me, {
      id: other.id,
      name: other.name,
      description: other.description,
      readme: other.readme,
      evidence: otherEvidence,
    });
    overlapResults.push(res);
    if (res.conceptualOverlap >= 28) {
      legacyOverlaps.push({
        repoId: other.id,
        name: other.name,
        percent: res.conceptualOverlap,
        note:
          res.conceptualOverlap >= 60
            ? res.recommendation
            : `Related to ${other.name} (~${res.conceptualOverlap}% conceptual overlap).`,
      });
    }
  }
  overlapResults.sort((a, b) => b.conceptualOverlap - a.conceptualOverlap);
  legacyOverlaps.sort((a, b) => b.percent - a.percent);

  const productization = assessProductization({
    name: repo.name,
    description: repo.description,
    readme: repo.readme,
    evidence,
  });

  const inputs: RecommendationInputs = {
    repo: {
      id: repo.id,
      name: repo.name,
      description: repo.description,
      isPrivate: repo.isPrivate,
      isPublic: !repo.isPrivate,
      stars: repo.stars,
      lastCommitDaysAgo: daysAgo(repo.lastCommitAt),
      commitCount: repo.commitCount,
    },
    evidence,
    overlaps: overlapResults,
    personalValue: options.personalValue ?? estimatePersonalValue(repo, evidence, readiness.readiness),
    productization,
  };

  const decision = recommend(inputs);

  return { decision, overlaps: overlapResults, legacyOverlaps: legacyOverlaps.slice(0, 3) };
}

export function estimatePersonalValue(repo: PipelineRepo, evidence: RepoScanEvidence, readiness: number): number {
  const age = daysAgo(repo.lastCommitAt);
  return Math.max(
    0,
    Math.min(
      95,
      Math.round(40 + (repo.isPrivate ? 12 : 0) + readiness * 0.2 + (evidence.runtime.database.length > 0 ? 8 : 0) - age / 40),
    ),
  );
}

export function workToBucket(w: WorkEstimate): "tiny" | "small" | "medium" | "large" | "massive" {
  const mid = (w.rangeHoursLow + w.rangeHoursHigh) / 2;
  if (mid <= 3) return "tiny";
  if (mid <= 8) return "small";
  if (mid <= 20) return "medium";
  if (mid <= 40) return "large";
  return "massive";
}

export { estimateWork, rangeLabel, scoreReadiness, buildEvidence };