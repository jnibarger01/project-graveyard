import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import type { Analysis, Repo } from "@/lib/types";

export const ACTION_KINDS = [
  "archive_repository",
  "create_issue",
  "create_pr",
  "finish_plan",
  "merge_repository",
  "readme_update",
  "label_repository",
] as const;
export type ActionKind = (typeof ACTION_KINDS)[number];

type ActionRow = {
  id: string;
  repo_id: string;
  repo_full_name: string | null;
  kind: string;
  title: string;
  description: string;
  definition_of_done: string | null;
  payload: ActionPayload | null;
  status: string;
  created_at: string;
  decided_at: string | null;
};

export interface ActionPayload {
  repo: string;
  analysisId: string;
  readiness: number;
  confidence: string;
}

export interface ProposedAction {
  id: string;
  repoId: string;
  repoFullName: string | null;
  kind: ActionKind;
  title: string;
  description: string;
  definitionOfDone: string | null;
  payload: ActionPayload | null;
  status: "proposed" | "approved" | "executed" | "declined";
  createdAt: string;
  decidedAt: string | null;
}

function asAction(row: ActionRow): ProposedAction {
  return {
    id: row.id,
    repoId: row.repo_id,
    repoFullName: row.repo_full_name,
    kind: row.kind as ActionKind,
    title: row.title,
    description: row.description,
    definitionOfDone: row.definition_of_done,
    payload: typeof row.payload === "string" ? (JSON.parse(row.payload) as ActionPayload) : (row.payload ?? null) as ActionPayload | null,
    status: row.status as ProposedAction["status"],
    createdAt: row.created_at,
    decidedAt: row.decided_at,
  };
}

/**
 * Build a proposed action from a recommendation WITHOUT executing anything.
 * External GitHub writes are never a side effect of analysis.
 */
export function proposeActionFromAnalysis(repo: Repo, analysis: Analysis): Omit<ProposedAction, "id" | "createdAt" | "decidedAt"> | null {
  const rec = analysis.recommendation;
  const base = {
    repoId: repo.id,
    repoFullName: repo.fullName,
    status: "proposed" as const,
    payload: {
      repo: repo.fullName,
      analysisId: analysis.analyzedAt,
      readiness: analysis.readiness ?? analysis.completionPct,
      confidence: analysis.recommendationConfidence ?? "low",
    },
    definitionOfDone: analysis.firstAction?.definitionOfDone ?? null,
  };
  switch (rec) {
    case "ARCHIVE":
      return { ...base, kind: "archive_repository", title: `Archive ${repo.name}`, description: "Mark the repository archived. No code is deleted." };
    case "MERGE": {
      const target = analysis.dependencies[0] ?? analysis.semanticOverlaps?.[0]?.otherName ?? "the target repository";
      return { ...base, kind: "merge_repository", title: `Consolidate ${repo.name} into ${target}`, description: `Lift the keepable pieces into ${target}, then archive ${repo.name}.` };
    }
    case "PRODUCTIZE":
      return { ...base, kind: "finish_plan", title: `Write a finishing plan for ${repo.name}`, description: "Turn the remaining-work estimate into a sequenced, approvable plan." };
    case "OPEN_SOURCE":
      return { ...base, kind: "readme_update", title: `Prepare ${repo.name} for release`, description: "Draft CONTRIBUTING, LICENSE, and a release checklist." };
    case "FINISH":
      return { ...base, kind: "finish_plan", title: `Finish ${repo.name}`, description: "Follow the first-action: " + (analysis.firstAction?.title ?? "complete the remaining work") };
    default:
      return null;
  }
}

export const listProposedActions = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { repoId?: string; status?: string }) => input)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    let rows: ActionRow[];
    if (data.repoId) {
      rows = await sql<ActionRow>`
        select * from proposed_actions
        where user_id = ${context.userId} and repo_id = ${data.repoId}
        order by created_at desc`;
    } else if (data.status) {
      rows = await sql<ActionRow>`
        select * from proposed_actions
        where user_id = ${context.userId} and status = ${data.status}
        order by created_at desc`;
    } else {
      rows = await sql<ActionRow>`
        select * from proposed_actions
        where user_id = ${context.userId}
        order by created_at desc`;
    }
    return rows.map(asAction);
  });

/** Propose an action. Persists as 'proposed'. Does NOT execute anything. */
export const proposeAction = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { repo: Repo }) => input)
  .handler(async ({ context, data }) => {
    const proposed = proposeActionFromAnalysis(data.repo, data.repo.analysis);
    if (!proposed) return { ok: false as const, reason: "No action applies to this recommendation." };
    const sql = await getSql();
    const inserted = await sql<ActionRow>`
      insert into proposed_actions (user_id, repo_id, repo_full_name, kind, title, description, definition_of_done, payload)
      values (${context.userId}, ${proposed.repoId}, ${proposed.repoFullName}, ${proposed.kind}, ${proposed.title}, ${proposed.description}, ${proposed.definitionOfDone}, ${JSON.stringify(proposed.payload)}::jsonb)
      returning id, repo_id, repo_full_name, kind, title, description, definition_of_done, payload, status, created_at, decided_at
    `;
    return { ok: true as const, action: asAction(inserted[0]) };
  });

/**
 * Approve/decline a proposed action. Approval ONLY records intent; it never
 * performs the GitHub mutation. A separate manual step (or future, clearly
 * explicit trigger) would be required to actually run it.
 */
export const decideAction = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; decision: "approved" | "declined" }) => input)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const rows = await sql<ActionRow>`
      update proposed_actions
      set status = ${data.decision}, decided_at = now()
      where id = ${data.id} and user_id = ${context.userId} and status = 'proposed'
      returning id, repo_id, repo_full_name, kind, title, description, definition_of_done, payload, status, created_at, decided_at
    `;
    if (rows.length === 0) throw new Error("Action not found or already decided");
    return asAction(rows[0]);
  });