import type { ReadinessResult, RepoScanEvidence, WorkEstimate } from "./types.ts";

export interface TimeRange {
  low: number;
  high: number;
  factor: string;
  confidence: number; // 0..1 how firm this line item is
}

/** Deterministic, evidence-driven hours estimate. Never asserts precision it lacks. */
export function estimateWork(e: RepoScanEvidence, _readiness: ReadinessResult): WorkEstimate {
  const items: TimeRange[] = [];
  const m = e.maturity;
  const u = e.unfinished;

  if (!m.testPresence) items.push({ low: 2, high: 6, factor: "No test suite — add tests", confidence: 0.5 });
  else if (m.testQuality === "minimal") items.push({ low: 1, high: 3, factor: "Test suite is thin — expand coverage", confidence: 0.6 });
  else if (m.testQuality === "some") items.push({ low: 1, high: 2, factor: "Top up test coverage", confidence: 0.6 });

  if (!m.ci) items.push({ low: 1, high: 4, factor: "No CI pipeline", confidence: 0.6 });
  if (!m.deployment) items.push({ low: 2, high: 8, factor: "No deployment configuration", confidence: 0.5 });
  if (m.documentation === "none") items.push({ low: 1, high: 4, factor: "README absent — write operator guide", confidence: 0.5 });
  else if (m.documentation === "minimal") items.push({ low: 0.5, high: 2, factor: "README thin — expand usage docs", confidence: 0.6 });
  if (!m.hasEnvConfig && e.health.missingEnvKeys.length > 0) {
    items.push({ low: 0.5, high: 2, factor: `Missing .env.example for ${e.health.missingEnvKeys.length} env keys`, confidence: 0.6 });
  }
  if (m.hasMigrations === false && e.runtime.database.length > 0) {
    items.push({ low: 2, high: 6, factor: "Database used but no migration setup", confidence: 0.5 });
  }

  if (u.todoCount > 0) {
    const per = 0.25;
    items.push({ low: u.todoCount * per * 0.5, high: u.todoCount * per, factor: `${u.todoCount} TODO/FIXME markers`, confidence: 0.4 });
  }
  if (u.stubs.length > 0) items.push({ low: u.stubs.length, high: u.stubs.length * 2, factor: `${u.stubs.length} stub/empty functions`, confidence: 0.4 });
  if (u.placeholders.length > 0) items.push({ low: u.placeholders.length, high: u.placeholders.length * 2, factor: `${u.placeholders.length} placeholder/unimplemented paths`, confidence: 0.4 });
  if (u.commentedOutBlocks > 0) items.push({ low: 0.5, high: 2, factor: `${u.commentedOutBlocks} commented-out blocks to reconcile`, confidence: 0.4 });
  if (u.mockData.length > 0) items.push({ low: 0.5, high: 2, factor: `${u.mockData.length} mock/demo datasets to replace`, confidence: 0.5 });

  if (e.health.dependencyConflicts.length > 0) items.push({ low: 1, high: 4, factor: "Dependency conflicts", confidence: 0.5 });
  if (e.health.missingEnvKeys.length > 0 && m.hasEnvConfig) {
    items.push({ low: 0.5, high: 2, factor: "Wire documented env keys", confidence: 0.5 });
  }

  if (items.length === 0) {
    items.push({ low: 0, high: 1, factor: "No outstanding work items detected — verify with a build/run", confidence: 0.3 });
  }

  const low = items.reduce((a, b) => a + b.low, 0);
  const high = items.reduce((a, b) => a + b.high, 0);
  const firmness = items.reduce((a, b) => a + b.confidence, 0) / items.length;

  let confidence: WorkEstimate["confidence"] = "medium";
  if (e.scanMode === "shallow") confidence = "low";
  else if (firmness >= 0.55 && low > 0) confidence = "high";
  else if (firmness < 0.4) confidence = "low";

  const label = rangeLabel(low, high);
  const factors = items.map((i) => i.factor);
  const unknowns: string[] = [];
  if (e.scanMode === "shallow") unknowns.push("Scanned from structure only — file contents were not inspected.");
  if (e.health.buildStatus === "unknown") unknowns.push("Production build has not been run/verified.");
  if (e.health.testStatus === "unknown") unknowns.push("Test status has not been verified by execution.");
  if (!m.deployment) unknowns.push("Production environment has not been verified.");
  if (e.health.missingEnvKeys.length > 0) unknowns.push("Exact runtime configuration is unknown without a working environment.");

  const reasoning =
    items.length === 0
      ? "No concrete unfinished work surfaced by the scan, so the estimate reflects verification time only."
      : `Estimate derived from ${items.length} concrete signals (missing tests/CI/deploy/docs and ${u.todoCount} markers).`;

  return {
    rangeHoursLow: Math.round(low * 10) / 10,
    rangeHoursHigh: Math.round(high * 10) / 10,
    rangeLabel: label,
    confidence,
    factors: factors.slice(0, 12),
    unknowns: [...new Set(unknowns)],
    reasoning,
  };
}

export function rangeLabel(lowHours: number, highHours: number): string {
  if (highHours < 1) return "Under 1 hour";
  if (highHours < 8) return `${ceilToHalf(lowHours)}–${ceilToHalf(highHours)} hours`;
  return `${hoursToDays(lowHours)}–${hoursToDays(highHours)} days`;
}

function ceilToHalf(h: number): number {
  const v = Math.ceil(h * 2) / 2;
  return v % 1 === 0 ? v : v;
}

function hoursToDays(h: number): string {
  const d = Math.max(0.5, Math.ceil((h / 8) * 2) / 2);
  return `${d}`;
}
