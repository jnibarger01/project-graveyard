import assert from "node:assert/strict";
import { test } from "node:test";
import {
  confidenceOf,
  mergeRefinement,
  parseAiOutput,
  workLabel,
  type MergeBase,
} from "../src/lib/scan/ai-model.ts";

function base(): MergeBase {
  return {
    fallbackRecommendation: "FINISH",
    fallbackSummary: "Heuristic summary",
    fallbackEvidence: [{ id: "e0", category: "scan", kind: "positive", claim: "Has source" }],
    fallbackBlockers: ["b0"],
    fallbackRisks: [],
    fallbackUnknowns: [],
    fallbackRemaining: {
      rangeHoursLow: 2,
      rangeHoursHigh: 6,
      rangeLabel: "2–6 hours",
      confidence: "medium",
      factors: [],
      unknowns: [],
      reasoning: "",
    },
    fallbackFirst: { title: "T", description: "D", definitionOfDone: "DONE" },
  };
}

test("parseAiOutput accepts valid JSON", () => {
  const d = parseAiOutput(
    JSON.stringify({ recommendation: "FINISH", confidence: 0.8, summary: "Bounded work", blockers: [], risks: [], knownUnknowns: [] }),
  );
  assert.equal(d.recommendation, "FINISH");
  assert.equal(confidenceOf(d), "high");
});

test("parseAiOutput accepts fenced JSON", () => {
  const d = parseAiOutput("```json\n" + JSON.stringify({ recommendation: "ARCHIVE", summary: "stale" }) + "\n```");
  assert.equal(d.recommendation, "ARCHIVE");
});

test("parseAiOutput rejects malformed JSON", () => {
  assert.throws(() => parseAiOutput("not json at all"));
});

test("parseAiOutput rejects output that violates the schema", () => {
  assert.throws(() => parseAiOutput(JSON.stringify({ recommendation: "INVALID_REC", summary: "" })));
  assert.throws(() => parseAiOutput(JSON.stringify({ summary: "missing recommendation" })));
  assert.throws(() => parseAiOutput(JSON.stringify({ recommendation: "FINISH" }))); // summary required
});

test("confidenceOf maps numeric and level inputs", () => {
  assert.equal(confidenceOf({ confidence: 0.9 }), "high");
  assert.equal(confidenceOf({ confidence: 0.5 }), "medium");
  assert.equal(confidenceOf({ confidence: 0.2 }), "low");
  assert.equal(confidenceOf({ confidenceLevel: "low" }), "low");
  assert.equal(confidenceOf({}), "low");
});

test("workLabel renders ranges", () => {
  assert.equal(workLabel(0, 0.5), "Under 1 hour");
  assert.equal(workLabel(1, 4), "1–4 hours");
  assert.match(workLabel(16, 40), /days/);
});

test("mergeRefinement: AI evidence and blockers are merged onto fallback, bounded", () => {
  const fallback = base();
  const manyEvidence = Array.from({ length: 50 }, (_, i) => ({
    category: "ai",
    kind: "positive" as const,
    claim: `claim ${i}`,
  }));
  const refined = mergeRefinement(fallback, {
    recommendation: "MERGE",
    confidence: 0.9,
    summary: "AI summary",
    evidence: manyEvidence,
    blockers: ["b1"],
    risks: ["r1"],
    knownUnknowns: ["k1"],
  });
  assert.equal(refined.recommendation, "MERGE");
  assert.equal(refined.recommendationConfidence, "high");
  assert.ok(refined.evidence.length <= 60);
  assert.ok(refined.evidence.length > 1, "fallback + ai evidence merged");
  assert.deepEqual(refined.blockers, ["b0", "b1"]);
  assert.deepEqual(refined.risks, ["r1"]);
});

test("mergeRefinement: keeps fallback remainingWork when AI omits it", () => {
  const refined = mergeRefinement(base(), {
    recommendation: "FINISH",
    summary: "s",
    blockers: [],
    risks: [],
    knownUnknowns: [],
  });
  assert.equal(refined.remainingWork?.rangeLabel, "2–6 hours");
  assert.equal(refined.firstAction?.title, "T");
});

test("mergeRefinement: AI remainingWork is labelled and used", () => {
  const refined = mergeRefinement(base(), {
    recommendation: "FINISH",
    summary: "s",
    blockers: [],
    risks: [],
    knownUnknowns: [],
    remainingWork: {
      rangeHoursLow: 10,
      rangeHoursHigh: 20,
      confidence: "low",
      factors: ["x"],
      unknowns: [],
      reasoning: "estimate",
    },
  });
  assert.match(refined.remainingWork?.rangeLabel ?? "", /days/);
});