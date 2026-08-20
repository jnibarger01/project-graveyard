export const RECOMMENDATIONS = [
  "FINISH",
  "ARCHIVE",
  "MERGE",
  "OPEN_SOURCE",
  "PRODUCTIZE",
  "UNKNOWN",
] as const;

export type Recommendation = (typeof RECOMMENDATIONS)[number];

export const PROJECT_STATES = [
  "idea",
  "early",
  "mvp",
  "mostly_complete",
  "production",
  "legacy",
  "abandoned",
  "unknown",
] as const;

export type ProjectState = (typeof PROJECT_STATES)[number];

export const WORK_REMAINING = ["tiny", "small", "medium", "large", "massive"] as const;
export type WorkRemaining = (typeof WORK_REMAINING)[number];

export const USER_STATUSES = [
  "none",
  "active",
  "snoozed",
  "finished",
  "abandoned",
  "queued",
] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export type Overlap = {
  repoId: string;
  name: string;
  percent: number;
  note: string;
};

export type Confidence = "low" | "medium" | "high";

export type EvidenceItem = import("./scan/types.ts").EvidenceItem;
export type RepoScanEvidence = import("./scan/types.ts").RepoScanEvidence;
export type ReadinessFactor = import("./scan/types.ts").ReadinessFactor;
export type WorkEstimate = import("./scan/types.ts").WorkEstimate;
export type FirstAction = import("./scan/types.ts").FirstAction;
export type ProductizationAssessment = import("./scan/types.ts").ProductizationAssessment;
export type OverlapResult = import("./scan/types.ts").OverlapResult;

export type Milestone = {
  id: string;
  title: string;
  done: boolean;
};

export type RemainingTask = {
  id: string;
  title: string;
  estimate: WorkRemaining;
  blockedBy?: string[];
};

export type Analysis = {
  purpose: string;
  currentState: ProjectState;
  whatsMissing: string[];
  recommendation: Recommendation;
  recommendationReason: string;
  workRemaining: WorkRemaining;
  workTasks: string[];
  completionPct: number;
  complexity: number;
  maintenanceBurden: number;
  usefulness: number;
  commercialPotential: number;
  ossPotential: number;
  personalUsefulness: number;
  portfolioValue: number;
  ossValue: number;
  learningValue: number;
  resurrectionScore: number;
  epitaph: string;
  causeOfDeath: string;
  bornDate: string;
  overlaps: Overlap[];
  facts: string[];
  assumptions: string[];
  mvpDefinition: string;
  milestones: Milestone[];
  taskList: RemainingTask[];
  firstTask: string;
  dependencies: string[];
  blockers: string[];
  definitionOfDone: string;
  analyzedAt: string;
  source: "heuristic" | "llm" | "seed";
  /** Evidence-backed execution readiness (replaces completionPct precision claims). */
  readiness?: number;
  readinessConfidence?: Confidence;
  readinessBreakdown?: ReadinessFactor[];
  evidence?: EvidenceItem[];
  risks?: string[];
  recommendationConfidence?: Confidence;
  knownUnknowns?: string[];
  remainingWork?: WorkEstimate;
  firstAction?: FirstAction;
  productization?: ProductizationAssessment;
  semanticOverlaps?: OverlapResult[];
  /** The structured scanner output for this repository. */
  scan?: RepoScanEvidence;
  /** Human/LLM advisory over the deterministic decision. */
  advisorySummary?: string;
  scannerVersion?: string;
};

export type Repo = {
  id: string;
  githubId?: number;
  name: string;
  fullName: string;
  description: string;
  isPrivate: boolean;
  isFork: boolean;
  language: string;
  languages: Record<string, number>;
  stars: number;
  forks: number;
  openIssues: number;
  openPrs: number;
  lastCommitAt: string;
  createdAtGh: string;
  pushedAt: string;
  sizeKb: number;
  defaultBranch: string;
  branchCount: number;
  commitCount: number;
  readmeQuality: number;
  hasTests: boolean;
  hasCi: boolean;
  hasDeploy: boolean;
  hasAuth: boolean;
  hasDb: boolean;
  todoCount: number;
  frameworks: string[];
  topics: string[];
  homepage?: string;
  htmlUrl: string;
  fileTree: string[];
  packageManifests: string[];
  userStatus: UserStatus;
  userNotes: string;
  snoozedUntil?: string;
  queuePosition: number | null;
  source: "demo" | "github";
  analysis: Analysis;
  /** Structured deep-scan evidence, when a deep scan ran. */
  scanEvidence?: RepoScanEvidence;
  /** Last analyzed commit SHA (for history snapshots). */
  commitSha?: string;
  analyzedCommitAt?: string;
};

export type GraveyardSettings = {
  humorEnabled: boolean;
  githubUsername: string | null;
  lastImportedAt: string | null;
};

export type DashboardStats = {
  total: number;
  active: number;
  dormant: number;
  archived: number;
  recoverable: number;
  potentialProducts: number;
  unfinishedWorkload: WorkRemaining;
  unfinishedDaysLow: number;
  unfinishedDaysHigh: number;
};

export type Filters = {
  q: string;
  recommendation: Recommendation | "all";
  language: string | "all";
  visibility: "all" | "public" | "private";
  activity: "all" | "active" | "dormant" | "archived";
  work: WorkRemaining | "all";
  minScore: number;
  minProduct: number;
};
