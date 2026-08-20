import type { Confidence, OverlapResult, RepoScanEvidence } from "./types.ts";

export interface OverlapProject {
  id: string;
  name: string;
  description: string;
  readme?: string;
  evidence: RepoScanEvidence;
}

function tokenSet(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/g)
      .filter((w) => w.length > 2)
      .filter((w) => !STOPWORDS.has(w)),
  );
}

const STOPWORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "have", "your", "you", "are", "was", "will", "been",
  "into", "then", "them", "their", "there", "these", "those", "about", "over", "under", "its", "also",
  "using", "used", "use", "via", "can", "make", "made", "some", "such", "very", "just", "not", "but",
  "project", "repository", "repo", "application", "app", "system", "tool", "simple", "small", "little",
]);

function jaccard(a: Set<string>, b: Set<string>): number {
  let inter = 0;
  for (const x of a) if (b.has(x)) inter += 1;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

function featureGroups(a: OverlapProject): { label: string; tokens: Set<string> }[] {
  const e = a.evidence;
  const text = `${a.description} ${a.readme ?? ""}`;
  return [
    { label: "purpose", tokens: tokenSet(text.slice(0, 2000)) },
    { label: "frameworks", tokens: new Set(e.runtime.frameworks.map((f) => f.toLowerCase())) },
    { label: "languages", tokens: new Set(e.runtime.languages.map((l) => l.toLowerCase())) },
    { label: "database", tokens: new Set(e.runtime.database.map((d) => d.toLowerCase())) },
    { label: "auth", tokens: new Set(e.runtime.auth.map((d) => d.toLowerCase())) },
    { label: "api", tokens: new Set(e.runtime.api.map((d) => d.toLowerCase())) },
    { label: "structure", tokens: tokenSet(e.structure.fileTree.join(" ").slice(0, 1500)) },
  ];
}

const WEIGHTS: Record<string, number> = {
  purpose: 0.45,
  frameworks: 0.15,
  languages: 0.05,
  database: 0.1,
  auth: 0.05,
  api: 0.1,
  structure: 0.1,
};

function listIntersection(a: string[], b: string[]): string[] {
  const bs = new Set(b.map((x) => x.toLowerCase()));
  return a.filter((x) => bs.has(x.toLowerCase())).map((x) => x.toLowerCase());
}

function listDiff(a: string[], b: string[]): string[] {
  const bs = new Set(b.map((x) => x.toLowerCase()));
  return a.filter((x) => !bs.has(x.toLowerCase()));
}

export function compareProjects(a: OverlapProject, b: OverlapProject): OverlapResult {
  const ga = featureGroups(a);
  const gb = featureGroups(b);
  let total = 0;
  for (const group of ga) {
    const other = gb.find((g) => g.label === group.label);
    if (!other) continue;
    total += jaccard(group.tokens, other.tokens) * (WEIGHTS[group.label] ?? 0);
  }
  const overlapPct = Math.round(total * 100);

  const shared = [
    ...listIntersection(a.evidence.runtime.frameworks, b.evidence.runtime.frameworks),
    ...listIntersection(a.evidence.runtime.api, b.evidence.runtime.api),
    ...listIntersection(a.evidence.runtime.database, b.evidence.runtime.database),
    ...listIntersection(a.evidence.runtime.auth, b.evidence.runtime.auth),
  ];
  const uniqueA = [
    ...listDiff(a.evidence.runtime.frameworks, b.evidence.runtime.frameworks),
    ...listDiff(a.evidence.runtime.api, b.evidence.runtime.api),
    ...listDiff(a.evidence.runtime.database, b.evidence.runtime.database),
  ];
  const uniqueB = [
    ...listDiff(b.evidence.runtime.frameworks, a.evidence.runtime.frameworks),
    ...listDiff(b.evidence.runtime.api, a.evidence.runtime.api),
    ...listDiff(b.evidence.runtime.database, a.evidence.runtime.database),
  ];

  let confidence: Confidence = "low";
  if (a.evidence.scanMode === "deep" && b.evidence.scanMode === "deep" && a.evidence.structure.fileCount > 0 && b.evidence.structure.fileCount > 0) confidence = "high";
  else if (a.evidence.scanMode === "deep" || b.evidence.scanMode === "deep") confidence = "medium";

  let recommendation: string;
  if (overlapPct >= 70 && a.evidence.structure.hasSource && b.evidence.structure.hasSource) {
    recommendation = `Merge ${a.name}'s keepable pieces into ${b.name}, then archive ${a.name}.`;
  } else if (overlapPct >= 55) {
    recommendation = `Consider consolidating ${a.name} into ${b.name}; the overlap is substantial.`;
  } else if (overlapPct >= 35) {
    recommendation = `Related, but not duplicates — reuse shared pieces instead of merging wholesale.`;
  } else {
    recommendation = `Low conceptual overlap — treat as separate projects.`;
  }

  return {
    otherRepoId: b.id,
    otherName: b.name,
    conceptualOverlap: overlapPct,
    sharedFunctionality: [...new Set(shared)].slice(0, 8),
    uniqueA: [...new Set(uniqueA)].slice(0, 6),
    uniqueB: [...new Set(uniqueB)].slice(0, 6),
    recommendation,
    confidence,
  };
}