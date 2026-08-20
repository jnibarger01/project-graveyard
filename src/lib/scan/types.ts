export type Confidence = "low" | "medium" | "high";

export type EvidenceKind = "positive" | "negative" | "neutral";

export interface EvidenceItem {
  id: string;
  category: string;
  kind: EvidenceKind;
  claim: string;
  detail?: string;
}

/** Recursive, content-aware picture of a repository produced by the scanner. */
export interface RepoScanEvidence {
  scanMode: "deep" | "shallow";
  structure: {
    fileCount: number;
    fileTree: string[];
    directories: string[];
    monorepo: boolean;
    workspaces: string[];
    hasSource: boolean;
    sourceDirs: string[];
    hasTests: boolean;
    testFiles: string[];
    hasCi: boolean;
    ciFiles: string[];
    hasDeploy: boolean;
    deployFiles: string[];
    hasDocker: boolean;
    hasMigrations: boolean;
    migrationFiles: string[];
    hasReleaseConfig: boolean;
    releaseFiles: string[];
    hasEnvConfig: boolean;
  };
  runtime: {
    languages: string[];
    languageBytes: Record<string, number>;
    frameworks: string[];
    packageManager: string | null;
    buildSystem: string[];
    database: string[];
    auth: string[];
    api: string[];
    frontend: string[];
    backend: string[];
    engines: string | null;
    runtimeRequires: string[];
  };
  maturity: {
    testPresence: boolean;
    testQuality: "none" | "minimal" | "some" | "good";
    ci: boolean;
    deployment: boolean;
    documentation: "none" | "minimal" | "adequate" | "good";
    readmeLength: number;
    hasEnvConfig: boolean;
    hasDocker: boolean;
    hasMigrations: boolean;
    hasRelease: boolean;
  };
  unfinished: {
    todoMarkers: { file: string; line: number; text: string }[];
    todoCount: number;
    fixmeCount: number;
    hackCount: number;
    xxxCount: number;
    placeholders: string[];
    commentedOutBlocks: number;
    stubs: string[];
    mockData: string[];
    deadEnds: string[];
    incompleteDocs: string[];
  };
  health: {
    dependencyConflicts: string[];
    staleDeps: string[];
    missingEnvKeys: string[];
    failingSignals: string[];
    risks: string[];
    buildStatus: "unknown" | "ok" | "broken";
    testStatus: "unknown" | "ok" | "broken";
  };
  summary: string;
}

export interface ReadinessFactor {
  id: string;
  label: string;
  weight: number;
  score: number;
  evidenceIds: string[];
}

export interface ReadinessResult {
  readiness: number;
  confidence: Confidence;
  factors: ReadinessFactor[];
  evidence: EvidenceItem[];
}

export type WorkConfidence = Confidence;

export interface WorkEstimate {
  rangeHoursLow: number;
  rangeHoursHigh: number;
  rangeLabel: string;
  confidence: WorkConfidence;
  factors: string[];
  unknowns: string[];
  reasoning: string;
}

export interface FirstAction {
  title: string;
  description: string;
  definitionOfDone: string;
}

export type RecommendationCode = "FINISH" | "ARCHIVE" | "MERGE" | "PRODUCTIZE" | "OPEN_SOURCE" | "UNKNOWN";

export interface ProductizationAssessment {
  problemClarity: number;
  targetUser: string | null;
  differentiation: string[];
  alternatives: string[];
  monetization: string[];
  technicalReadiness: number;
  distributionDifficulty: "low" | "medium" | "high";
  implementationEffort: WorkEstimate;
  marketResearched: boolean;
  unverified: string[];
  verdict: string;
}

/** The unified, evidence-backed decision produced for a single project. */
export interface ProjectDecision {
  recommendation: RecommendationCode;
  recommendationConfidence: Confidence;
  summary: string;
  evidence: EvidenceItem[];
  readiness: ReadinessResult;
  blockers: string[];
  risks: string[];
  remainingWork: WorkEstimate;
  firstAction: FirstAction;
  knownUnknowns: string[];
  source: "deep-scan" | "shallow-scan" | "ai";
  productization?: ProductizationAssessment;
}

/** Human-readable overlap between two projects. */
export interface OverlapResult {
  otherRepoId: string;
  otherName: string;
  conceptualOverlap: number;
  sharedFunctionality: string[];
  uniqueA: string[];
  uniqueB: string[];
  recommendation: string;
  confidence: Confidence;
}

/** Ranking entry for "What should I work on tonight?". */
export interface TonightCandidate {
  repoId: string;
  name: string;
  recommendation: RecommendationCode;
  expectedValue: number;
  fitsTime: boolean;
  why: string;
  doNext: string;
  definitionOfDone: string;
  afterThat: string;
  estimatedHours: number;
}
