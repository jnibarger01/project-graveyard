-- Immutable analysis snapshots: one row per run, never overwritten, so a
-- re-scan preserves history and enables "what changed since last review?".
create table if not exists analysis_runs (
  id bigserial primary key,
  user_id text not null,
  repo_id text not null,
  repo_full_name text,
  commit_sha text,
  scanner_version text,
  analyzed_at timestamptz not null default now(),
  payload jsonb not null
);

create index if not exists analysis_runs_user_repo_idx
  on analysis_runs (user_id, repo_id, analyzed_at desc);

-- Approval-gated external actions. Rows are never executed automatically; a
-- GitHub write only happens after explicit user approval AND a manual trigger.
create table if not exists proposed_actions (
  id bigserial primary key,
  user_id text not null,
  repo_id text not null,
  repo_full_name text,
  kind text not null,
  title text not null,
  description text not null,
  definition_of_done text,
  payload jsonb,
  status text not null default 'proposed',
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create index if not exists proposed_actions_user_idx
  on proposed_actions (user_id, status);