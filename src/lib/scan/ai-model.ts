import { z } from "zod";
import type { Confidence, EvidenceItem, FirstAction, RecommendationCode, WorkEstimate } from "./types.ts";

const RECS = ["FINISH", "ARCHIVE", "MERGE", "OPEN_SOURCE", "PRODUCTIZE", "UNKNOWN"] as const;
const CONFIDENCE = ["low", "medium", "high"] as const;

export const aiDecisionSchema = z.object({
  recommendation: z.enum(RECS),
  confidence: z.number().min(0).max(1).optional(),
  confidenceLevel: z.enum(CONFIDENCE).optional(),
  summary: z.string().min(1),
  evidence: z
    .array(
      z.object({
        category: z.string(),
        kind: z.enum(["positive", "negative", "neutral"]),
        claim: z.string(),
        detail: z.string().optional(),
      }),
    )
    .max(20)
    .default([]),
  blockers: z.array(z.string()).max(8).default([]),
  risks: z.array(z.string()).max(8).default([]),
  knownUnknowns: z.array(z.string()).max(8).default([]),
  remainingWork: z
    .object({
      rangeHoursLow: z.number().min(0),
      rangeHoursHigh: z.number().min(0),
      confidence: z.enum(CONFIDENCE),
      factors: z.array(z.string()).max(12),
      unknowns: z.array(z.string()).max(8).default([]),
      reasoning: z.string(),
    })
    .optional(),
  firstAction: z
    .object({
      title: z.string(),
      description: z.string(),
      definitionOfDone: z.string(),
    })
    .optional(),
});

export type AiDecision = z.infer<typeof aiDecisionSchema>;

export function confidenceOf(d: Pick<AiDecision, "confidenceLevel" | "confidence">): Confidence {
  if (d.confidenceLevel) return d.confidenceLevel;
  if (d.confidence === undefined) return "low";
  if (d.confidence < 0.4) return "low";
  if (d.confidence < 0.7) return "medium";
  return "high";
}

/** Parse + validate the model's raw text output. Throws on malformed/invalid JSON. */
export function parseAiOutput(raw: string): AiDecision {
  const jsonText = raw.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  const parsed = JSON.parse(jsonText) as unknown;
  return aiDecisionSchema.parse(parsed);
}

export function workLabel(low: number, high: number): string {
  if (high < 1) return "Under 1 hour";
  if (high < 8) return `${low}–${high} hours`;
  return `${Math.max(0.5, low / 8)}–${Math.max(0.5, high / 8)} days`;
}

export interface MergeBase {
  fallbackRecommendation: RecommendationCode;
  fallbackSummary: string;
  fallbackEvidence: EvidenceItem[];
  fallbackBlockers: string[];
  fallbackRisks: string[];
  fallbackUnknowns: string[];
  fallbackRemaining: WorkEstimate | undefined;
  fallbackFirst: FirstAction | undefined;
}

export interface AiRefinement {
  recommendation: RecommendationCode;
  recommendationConfidence: Confidence;
  advisorySummary: string;
  evidence: EvidenceItem[];
  blockers: string[];
  risks: string[];
  knownUnknowns: string[];
  remainingWork: WorkEstimate | undefined;
  firstAction: FirstAction | undefined;
}

/**
 * Merge a validated AI decision onto a deterministic fallback, keeping evidence
 * bounded and never trusting model facts the evidence doesn't contain.
 */
export function mergeRefinement(base: MergeBase, decision: AiDecision): AiRefinement {
  const remaining = decision.remainingWork
    ? { ...decision.remainingWork, rangeLabel: workLabel(decision.remainingWork.rangeHoursLow, decision.remainingWork.rangeHoursHigh) }
    : base.fallbackRemaining;
  return {
    recommendation: decision.recommendation as RecommendationCode,
    recommendationConfidence: confidenceOf(decision),
    advisorySummary: decision.summary,
    evidence: [...base.fallbackEvidence, ...(decision.evidence ?? []).map((e, i) => ({ ...e, id: `ai-${i}` }))].slice(0, 60),
    blockers: [...new Set([...base.fallbackBlockers, ...(decision.blockers ?? [])])].slice(0, 6),
    risks: [...new Set([...base.fallbackRisks, ...(decision.risks ?? [])])].slice(0, 6),
    knownUnknowns: [...new Set([...base.fallbackUnknowns, ...(decision.knownUnknowns ?? [])])].slice(0, 6),
    remainingWork: remaining,
    firstAction: decision.firstAction ?? base.fallbackFirst,
  };
}