import type { EvidenceItem, ReadinessFactor, ReadinessResult, RepoScanEvidence } from "./types.ts";

export interface ReadinessFactorDef {
  id: string;
  label: string;
  weight: number;
  score: number;
  evidence: EvidenceItem[];
}

function ev(id: string, kind: EvidenceItem["kind"], claim: string, detail?: string): EvidenceItem {
  return { id, category: "readiness", kind, claim, detail };
}

function factorScore(partial: number): number {
  return Math.max(0, Math.min(1, partial));
}

export function scoreReadiness(e: RepoScanEvidence): ReadinessResult {
  const factors: ReadinessFactorDef[] = [];

  // Structure & boundaries
  {
    const s = e.structure;
    let score = 0;
    if (s.hasSource) score += 0.5;
    if (s.fileCount > 5) score += 0.3;
    if (s.monorepo && s.workspaces.length > 0) score += 0.2;
    const evidence: EvidenceItem[] = [];
    if (s.hasSource) evidence.push(ev("struct-src", "positive", "Source directories present", s.sourceDirs.join(", ")));
    if (s.monorepo) evidence.push(ev("struct-mono", "neutral", "Monorepo / workspace structure", s.workspaces.join(", ")));
    if (s.fileCount === 0) evidence.push(ev("struct-empty", "negative", "No files detected in the repository"));
    factors.push({ id: "structure", label: "Structure & boundaries", weight: 0.08, score: factorScore(score), evidence });
  }

  // Tests
  {
    const m = e.maturity;
    let score = 0;
    const qualityMap: Record<string, number> = { none: 0, minimal: 0.25, some: 0.6, good: 1 };
    score = m.testPresence ? qualityMap[m.testQuality] : 0;
    const evidence: EvidenceItem[] = [];
    if (m.testPresence) evidence.push(ev("test-pres", "positive", `Test suite present (${e.structure.testFiles.length} files)`, `quality: ${m.testQuality}`));
    else evidence.push(ev("test-absent", "negative", "No tests detected"));
    if (m.testQuality === "good") evidence.push(ev("test-good", "positive", "Tests are substantial (assertions across files)"));
    if (m.testQuality === "minimal") evidence.push(ev("test-min", "neutral", "Tests exist but are thin"));
    factors.push({ id: "tests", label: "Tests", weight: 0.18, score: factorScore(score), evidence });
  }

  // CI
  {
    const score = e.maturity.ci ? 1 : 0;
    const evidence: EvidenceItem[] = e.maturity.ci
      ? [ev("ci-yes", "positive", "CI configured", e.structure.ciFiles.join(", "))]
      : [ev("ci-no", "negative", "No continuous integration detected")];
    factors.push({ id: "ci", label: "CI/CD", weight: 0.1, score: factorScore(score), evidence });
  }

  // Deployment
  {
    const score = e.maturity.deployment ? 1 : 0;
    const evidence: EvidenceItem[] = e.maturity.deployment
      ? [ev("deploy-yes", "positive", "Deployment configuration present", e.structure.deployFiles.join(", "))]
      : [ev("deploy-no", "negative", "No deployment configuration detected")];
    factors.push({ id: "deployment", label: "Deployment", weight: 0.1, score: factorScore(score), evidence });
  }

  // Documentation
  {
    const qualityMap: Record<string, number> = { none: 0, minimal: 0.3, adequate: 0.7, good: 1 };
    const score = qualityMap[e.maturity.documentation];
    const evidence: EvidenceItem[] = [
      e.maturity.documentation === "none"
        ? ev("doc-none", "negative", "No README documentation")
        : e.maturity.documentation === "minimal"
          ? ev("doc-thin", "negative", "README is thin")
          : ev("doc-good", "positive", "Documentation is adequate or better", `${e.maturity.readmeLength} chars`),
    ];
    factors.push({ id: "documentation", label: "Documentation", weight: 0.1, score: factorScore(score), evidence });
  }

  // Runtime / architecture wiring
  {
    const r = e.runtime;
    let score = 0;
    if (r.frameworks.length > 0) score += 0.4;
    if (r.frontend.length > 0 || r.backend.length > 0) score += 0.3;
    if (r.api.length > 0) score += 0.2;
    if (r.packageManager) score += 0.1;
    const evidence: EvidenceItem[] = [];
    if (r.frameworks.length) evidence.push(ev("rt-fw", "positive", "Frameworks identified", r.frameworks.join(", ")));
    if (r.backend.length) evidence.push(ev("rt-be", "positive", "Backend signals", r.backend.join(", ")));
    if (r.database.length) evidence.push(ev("rt-db", "neutral", "Database usage detected", r.database.join(", ")));
    if (!r.packageManager) evidence.push(ev("rt-pm", "negative", "No recognizable package manager / lockfile"));
    factors.push({ id: "runtime", label: "Runtime & architecture", weight: 0.1, score: factorScore(score), evidence });
  }

  // Unfinished work burden
  {
    const u = e.unfinished;
    const total = u.todoCount + u.stubs.length + u.placeholders.length + u.mockData.length + u.deadEnds.length;
    let score = 1;
    if (total > 30) score = 0.15;
    else if (total > 18) score = 0.35;
    else if (total > 8) score = 0.6;
    else if (total > 3) score = 0.8;
    else if (total > 0) score = 0.92;
    const evidence: EvidenceItem[] = [];
    if (u.todoCount > 0) evidence.push(ev("todo", "negative", `${u.todoCount} TODO/FIXME/HACK markers`, `fixme: ${u.fixmeCount} · hack: ${u.hackCount} · xxx: ${u.xxxCount}`));
    if (u.stubs.length > 0) evidence.push(ev("stubs", "negative", `${u.stubs.length} stub/empty functions`, u.stubs.slice(0, 3).join(", ")));
    if (u.placeholders.length > 0) evidence.push(ev("place", "negative", "Placeholder / unimplemented paths", u.placeholders.slice(0, 3).join(", ")));
    if (u.mockData.length > 0) evidence.push(ev("mock", "neutral", "Mock/demo data present", u.mockData.slice(0, 4).join(", ")));
    if (u.todoCount === 0 && total === 0) evidence.push(ev("clean", "positive", "No unfinished-work markers in scanned files"));
    factors.push({ id: "unfinished", label: "Unfinished work", weight: 0.2, score: factorScore(score), evidence });
  }

  // Health & environment
  {
    const h = e.health;
    const m = e.maturity;
    let score = 1;
    const deductions = h.risks.length * 0.12 + h.staleDeps.length * 0.05 + h.missingEnvKeys.length * 0.08 + (h.dependencyConflicts.length ? 0.3 : 0);
    if (m.hasEnvConfig) score = Math.max(score, 0.5);
    score = Math.max(0.05, Math.min(1, score - deductions));
    const evidence: EvidenceItem[] = [];
    if (h.missingEnvKeys.length > 0) evidence.push(ev("env", "negative", "Env vars referenced but no .env.example", h.missingEnvKeys.slice(0, 4).join(", ")));
    if (h.risks.length > 0) evidence.push(ev("health-risk", "negative", h.risks[0]));
    if (m.hasEnvConfig) evidence.push(ev("envcfg", "positive", "Environment configuration template present"));
    if (h.risks.length === 0 && h.missingEnvKeys.length === 0) evidence.push(ev("health-ok", "positive", "No obvious health/config red flags"));
    factors.push({ id: "health", label: "Health & environment", weight: 0.14, score: factorScore(score), evidence });
  }

  // Weighted total
  let readiness = 0;
  let weightSum = 0;
  for (const f of factors) {
    readiness += f.score * f.weight;
    weightSum += f.weight;
  }
  readiness = weightSum > 0 ? readiness / weightSum : 0;

  // Confidence: deep scans with content are more trustworthy.
  const scannedContent = e.scanMode === "deep";
  const signalCount = e.structure.fileCount + e.unfinished.todoCount;
  let confidence: ReadinessResult["confidence"] = "medium";
  if (!scannedContent) confidence = "low";
  else if (signalCount >= 5 && e.structure.fileCount >= 10) confidence = "high";

  const allEvidence: EvidenceItem[] = factors.flatMap((f) => f.evidence);
  const readabilityFactors: ReadinessFactor[] = factors.map((f) => ({
    id: f.id,
    label: f.label,
    weight: f.weight,
    score: Math.round(f.score * 100),
    evidenceIds: f.evidence.map((x) => x.id),
  }));

  return {
    readiness: Math.round(readiness * 100),
    confidence,
    factors: readabilityFactors,
    evidence: allEvidence,
  };
}
