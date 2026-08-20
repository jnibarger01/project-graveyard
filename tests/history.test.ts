import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

const migration = readFileSync(new URL("../migrations/0003_history_actions.sql", import.meta.url), "utf8");

async function freshDb() {
  const db = new PGlite();
  await db.exec(migration);
  return db;
}

test("history: repeated analysis of the same commit appends immutable snapshots", async () => {
  const db = await freshDb();
  await db.exec("create table graveyard_repos (id text primary key, user_id text not null, payload jsonb not null)");
  const repo = { id: "r1", name: "todo-app", commitSha: "abc123" };
  const analysis = { recommendation: "FINISH", analyzedAt: new Date().toISOString() };

  await db.query(
    `insert into analysis_runs (user_id, repo_id, repo_full_name, commit_sha, scanner_version, payload)
     values ($1,$2,$3,$4,$5,$6::jsonb)`,
    ["u1", "r1", repo.name, "abc123", "1.0.0", JSON.stringify(analysis)],
  );
  // same commit, re-analyzed moments later — still a NEW snapshot, nothing overwritten
  await db.query(
    `insert into analysis_runs (user_id, repo_id, repo_full_name, commit_sha, scanner_version, payload)
     values ($1,$2,$3,$4,$5,$6::jsonb)`,
    ["u1", "r1", repo.name, "abc123", "1.0.0", JSON.stringify({ ...analysis, advisorySummary: "second run" })],
  );
  const result = await db.query<{ id: number; commit_sha: string }>(
    `select id, commit_sha from analysis_runs where user_id=$1 and repo_id=$2 order by analyzed_at desc`,
    ["u1", "r1"],
  );
  const rows = result.rows;
  assert.equal(rows.length, 2, "both snapshots retained");
  assert.equal(rows[0].commit_sha, "abc123");
});

test("history: a new commit produces a snapshot with the new commit sha", async () => {
  const db = await freshDb();
  const payload = { recommendation: "FINISH", analyzedAt: new Date().toISOString() };
  await db.query(
    `insert into analysis_runs (user_id, repo_id, repo_full_name, commit_sha, scanner_version, payload)
     values ($1,$2,$3,$4,$5,$6::jsonb)`,
    ["u1", "r1", "todo-app", "abc123", "1.0.0", JSON.stringify(payload)],
  );
  await db.query(
    `insert into analysis_runs (user_id, repo_id, repo_full_name, commit_sha, scanner_version, payload)
     values ($1,$2,$3,$4,$5,$6::jsonb)`,
    ["u1", "r1", "todo-app", "def456", "1.0.0", JSON.stringify({ ...payload, advisorySummary: "after changes" })],
  );
  const result = await db.query<{ commit_sha: string; scanner_version: string }>(
    `select commit_sha, scanner_version from analysis_runs where user_id=$1 order by analyzed_at desc`,
    ["u1"],
  );
  const rows = result.rows;
  assert.equal(rows.length, 2);
  assert.equal(rows[0].commit_sha, "def456", "newest first, with the new commit");
  assert.equal(rows[0].scanner_version, "1.0.0");
});

test("history: analysis_runs is scoped per user", async () => {
  const db = await freshDb();
  const payload = { recommendation: "ARCHIVE", analyzedAt: new Date().toISOString() };
  await db.query(
    `insert into analysis_runs (user_id, repo_id, repo_full_name, commit_sha, scanner_version, payload)
     values ($1,$2,$3,$4,$5,$6::jsonb)`,
    ["u1", "r1", "a", "abc", "1.0.0", JSON.stringify(payload)],
  );
  await db.query(
    `insert into analysis_runs (user_id, repo_id, repo_full_name, commit_sha, scanner_version, payload)
     values ($1,$2,$3,$4,$5,$6::jsonb)`,
    ["u2", "r1", "a", "abc", "1.0.0", JSON.stringify(payload)],
  );
  const result = await db.query(`select id from analysis_runs where user_id=$1`, ["u1"]);
  assert.equal(result.rows.length, 1);
});

test("actions: proposals persist as proposed and can be decided", async () => {
  const db = await freshDb();
  const payload = JSON.stringify({ repo: "todo-app", analysisId: "now", readiness: 70, confidence: "medium" });
  const ins = await db.query<{ id: number; status: string }>(
    `insert into proposed_actions (user_id, repo_id, repo_full_name, kind, title, description, definition_of_done, payload)
     values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb) returning id, status`,
    ["u1", "r1", "todo-app", "finish_plan", "Finish todo-app", "desc", "DONE", payload],
  );
  assert.equal(ins.rows[0].status, "proposed");

  // approval never executes anything; it just records intent
  const upd = await db.query<{ status: string; decided_at: string | null }>(
    `update proposed_actions set status=$1, decided_at=now() where id=$2 and user_id=$3 and status='proposed' returning status, decided_at`,
    ["approved", ins.rows[0].id, "u1"],
  );
  assert.equal(upd.rows[0].status, "approved");
  assert.ok(upd.rows[0].decided_at);

  // already decided: cannot be re-decided
  const again = await db.query(`update proposed_actions set status=$1 where id=$2 and status='proposed'`, ["declined", ins.rows[0].id]);
  assert.equal(again.rows.length, 0);
});