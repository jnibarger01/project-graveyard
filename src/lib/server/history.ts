import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import type { Analysis, Repo } from "@/lib/types";

type RunRow = {
  id: string;
  repo_full_name: string | null;
  commit_sha: string | null;
  scanner_version: string | null;
  analyzed_at: string;
  payload: unknown;
};

export interface AnalysisRun {
  id: string;
  repoFullName: string | null;
  commitSha: string | null;
  scannerVersion: string | null;
  analyzedAt: string;
  analysis: Analysis;
}

export function asAnalysis(payload: unknown): Analysis {
  return (typeof payload === "string" ? JSON.parse(payload) : payload) as Analysis;
}

function asRun(row: RunRow): AnalysisRun {
  return {
    id: row.id,
    repoFullName: row.repo_full_name,
    commitSha: row.commit_sha,
    scannerVersion: row.scanner_version,
    analyzedAt: row.analyzed_at,
    analysis: asAnalysis(row.payload),
  };
}

/** Append an immutable snapshot for an analysis run. Never overwrites history. */
export async function recordAnalysisRun(userId: string, repo: Repo, analysis: Analysis): Promise<void> {
  const sql = await getSql();
  await sql.query(
    `insert into analysis_runs (user_id, repo_id, repo_full_name, commit_sha, scanner_version, payload)
     values ($1, $2, $3, $4, $5, $6::jsonb)`,
    [userId, repo.id, repo.fullName ?? null, repo.commitSha ?? null, analysis.scannerVersion ?? null, JSON.stringify(analysis)],
  );
}

export const loadAnalysisHistory = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { repoId: string; limit?: number }) => input)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const rows = await sql<RunRow>`
      select id, repo_full_name, commit_sha, scanner_version, analyzed_at, payload
      from analysis_runs
      where user_id = ${context.userId} and repo_id = ${data.repoId}
      order by analyzed_at desc
      limit ${data.limit ?? 10}
    `;
    return rows.map(asRun);
  });

export const compareAnalysisRuns = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { repoId: string }) => input)
  .handler(async ({ context: _context, data }) => {
    const runs = await loadAnalysisHistory({ data: { repoId: data.repoId, limit: 2 } });
    const current = runs[0];
    const previous = runs[1];
    if (!current || !previous) {
      return {
        hasHistory: false as const,
        message: previous ? "One snapshot recorded — another analysis is needed to compare." : "No prior analysis snapshots to compare against.",
      };
    }
    const prevReady = previous.analysis.readiness ?? previous.analysis.completionPct;
    const curReady = current.analysis.readiness ?? current.analysis.completionPct;
    return {
      hasHistory: true as const,
      previous: previous.analysis,
      current: current.analysis,
      previousReadiness: prevReady,
      currentReadiness: curReady,
      readinessDelta: curReady - prevReady,
      previousRecommendation: previous.analysis.recommendation,
      currentRecommendation: current.analysis.recommendation,
      previousAnalyzedAt: previous.analyzedAt,
      currentAnalyzedAt: current.analyzedAt,
    };
  });