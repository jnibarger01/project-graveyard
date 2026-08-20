import type { ProjectDecision, RecommendationCode, RepoScanEvidence, TonightCandidate } from "./types.ts";

export type TimeBudget = "30min" | "1h" | "2h" | "evening" | "weekend";

export const BUDGET_HOURS: Record<TimeBudget, number> = {
  "30min": 0.5,
  "1h": 1,
  "2h": 2,
  evening: 4,
  weekend: 8,
};

export interface TonightProject {
  repoId: string;
  name: string;
  description: string;
  decision: ProjectDecision;
  evidence?: RepoScanEvidence;
  userStatus: string;
}

const REC_PREFERENCE: Record<RecommendationCode, number> = {
  FINISH: 3,
  OPEN_SOURCE: 2,
  PRODUCTIZE: 2,
  MERGE: 1,
  ARCHIVE: 0,
  UNKNOWN: 0,
};

/** Expected value: how much a budget-sized session moves the project toward a milestone. */
export function rankTonight(projects: TonightProject[], budget: TimeBudget): TonightCandidate[] {
  const hours = BUDGET_HOURS[budget];
  return projects
    .map((p) => {
      const d = p.decision;
      const work = d.remainingWork;
      const midEstimate = (work.rangeHoursLow + work.rangeHoursHigh) / 2;

      // How far one session gets you toward completion (0..1). A small remaining
      // chunk that this budget can meaningfully dent beats a huge one.
      const sessionProgress = midEstimate <= 0 ? 0 : Math.min(1, hours / midEstimate);

      const confidenceWeight = d.recommendationConfidence === "high" ? 1 : d.recommendationConfidence === "medium" ? 0.7 : 0.4;
      const recWeight = REC_PREFERENCE[d.recommendation];
      const blockedPenalty = d.blockers.length * 0.12;
      const readinessPull = d.readiness.readiness / 100;

      const expectedValue = Math.max(
        0,
        Math.round(
          100 * (0.5 * sessionProgress + 0.2 * readinessPull + 0.15 * confidenceWeight + 0.15 * recWeight - blockedPenalty),
        ),
      );

      const fitsTime = midEstimate <= hours * 2.5; // a meaningful chunk can be done
      const capped = Math.min(expectedValue, fitsTime ? expectedValue : expectedValue * 0.6);

      const why =
        d.recommendation === "FINISH" && d.readiness.readiness >= 70
          ? "closest to a meaningful finish"
          : d.recommendation === "FINISH"
            ? "bounded remaining work you can dent tonight"
            : d.recommendation === "OPEN_SOURCE"
              ? "packaging-only work that unlocks a release"
              : d.recommendation === "MERGE"
                ? "consolidation removes a maintenance liability"
                : "quick decision with high closure value";

      const afterThat = "next-ranked project on this list";

      return {
        repoId: p.repoId,
        name: p.name,
        recommendation: d.recommendation,
        expectedValue: capped,
        fitsTime,
        why,
        doNext: d.firstAction.title,
        definitionOfDone: d.firstAction.definitionOfDone,
        afterThat,
        estimatedHours: Math.max(0.25, Math.round(midEstimate * 10) / 10),
      };
    })
    .filter((c) => c.expectedValue > 0)
    .sort((a, b) => b.expectedValue - a.expectedValue)
    .slice(0, 8);
}

export function budgetLabel(budget: TimeBudget): string {
  return { "30min": "30 minutes", "1h": "1 hour", "2h": "2 hours", evening: "an evening", weekend: "a weekend" }[budget];
}