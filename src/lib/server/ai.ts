import { analyzeRepo, toSignals } from "@/lib/analysis";
import type { Analysis, Recommendation, Repo } from "@/lib/types";
import { mergeRefinement, parseAiOutput, type AiDecision } from "@/lib/scan/ai-model";

/**
 * AI review layer. Receives *structured evidence* (scanner + deterministic
 * decision), asks the model to refine a recommendation, validates the output
 * against a strict schema, and falls back to the deterministic decision on any
 * failure. Never fabricates facts the evidence doesn't contain.
 */
export async function analyzeWithLlm(repo: Repo, others: Repo[]): Promise<Analysis> {
  const fallback = analyzeRepo(toSignals(repo), others.map(toSignals));
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return { ...fallback, source: "heuristic" };

  // Structured evidence the model reviews — not a bare repo name + README.
  const payload = {
    repository: {
      name: repo.name,
      description: repo.description,
      private: repo.isPrivate,
      language: repo.language,
      stars: repo.stars,
      lastCommitAt: repo.lastCommitAt,
      commits: repo.commitCount,
    },
    readiness: {
      score: fallback.readiness ?? fallback.completionPct,
      confidence: fallback.readinessConfidence ?? "low",
      factors: fallback.readinessBreakdown ?? [],
    },
    evidence: (fallback.evidence ?? []).slice(0, 40),
    scan: fallback.scan
      ? {
          scanMode: fallback.scan.scanMode,
          structure: fallback.scan.structure,
          runtime: {
            languages: fallback.scan.runtime.languages,
            frameworks: fallback.scan.runtime.frameworks,
            packageManager: fallback.scan.runtime.packageManager,
            database: fallback.scan.runtime.database,
            auth: fallback.scan.runtime.auth,
          },
          maturity: fallback.scan.maturity,
          unfinished: {
            todoCount: fallback.scan.unfinished.todoCount,
            stubs: fallback.scan.unfinished.stubs.length,
            placeholders: fallback.scan.unfinished.placeholders.length,
            mockData: fallback.scan.unfinished.mockData.length,
          },
          health: fallback.scan.health,
        }
      : null,
    remainingWork: fallback.remainingWork ?? null,
    blockers: fallback.blockers,
    risks: fallback.risks ?? [],
    overlaps: (fallback.semanticOverlaps ?? []).map((o) => ({
      other: o.otherName,
      overlap: o.conceptualOverlap,
      shared: o.sharedFunctionality,
    })),
    productization: fallback.productization
      ? {
          problemClarity: fallback.productization.problemClarity,
          targetUser: fallback.productization.targetUser,
          technicalReadiness: fallback.productization.technicalReadiness,
          marketResearched: fallback.productization.marketResearched,
        }
      : null,
  };

  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "grok-4.5",
      temperature: 0.2,
      max_tokens: 1800,
      messages: [
        {
          role: "system",
          content:
            "You are a senior engineer reviewing an unfinished repository. You are given STRUCTURED EVIDENCE from a deterministic scanner, never a bare repository name. Do NOT fabricate facts: build status, test results, deployment, market demand, and remaining work must come from the provided evidence. If the evidence cannot support a recommendation, return recommendation UNKNOWN. Choose exactly one recommendation: FINISH, ARCHIVE, MERGE, OPEN_SOURCE, PRODUCTIZE, UNKNOWN. Return ONLY valid JSON matching the schema exactly.",
        },
        {
          role: "user",
          content: `Review this repository and produce a recommendation. Evidence:\n\n${JSON.stringify(payload, null, 2)}\n\nRespond with JSON: { recommendation, confidenceLevel (low|medium|high), summary, evidence[{category,kind,claim,detail?}], blockers[], risks[], knownUnknowns[], remainingWork{rangeHoursLow,rangeHoursHigh,confidence,factors,unknowns,reasoning}, firstAction{title,description,definitionOfDone} }`,
        },
      ],
    }),
  });

  if (!res.ok) return { ...fallback, source: "heuristic" };
  const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = body.choices?.[0]?.message?.content ?? "";
  let decision: AiDecision;
  try {
    decision = parseAiOutput(raw);
  } catch {
    return { ...fallback, source: "heuristic" };
  }

  const aiRec = decision.recommendation as Recommendation;

  const refined = mergeRefinement(
    {
      fallbackRecommendation: fallback.recommendation,
      fallbackSummary: fallback.recommendationReason,
      fallbackEvidence: fallback.evidence ?? [],
      fallbackBlockers: fallback.blockers,
      fallbackRisks: fallback.risks ?? [],
      fallbackUnknowns: fallback.knownUnknowns ?? [],
      fallbackRemaining: fallback.remainingWork,
      fallbackFirst: fallback.firstAction,
    },
    decision,
  );

  return {
    ...fallback,
    recommendation: aiRec,
    recommendationConfidence: refined.recommendationConfidence,
    advisorySummary: refined.advisorySummary,
    recommendationReason: refined.advisorySummary || fallback.recommendationReason,
    evidence: refined.evidence,
    blockers: refined.blockers,
    risks: refined.risks,
    knownUnknowns: refined.knownUnknowns,
    remainingWork: refined.remainingWork,
    firstAction: refined.firstAction,
    analyzedAt: new Date().toISOString(),
    source: "llm",
  };
}

export type { AiDecision };