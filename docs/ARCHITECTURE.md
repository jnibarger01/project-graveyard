# Project Graveyard — Evidence-Backed Decision Engine

This document explains how Project Graveyard turns a repository into a decision
(recommend, archive, merge, finish, productize, open-source) and what evidence
backs each verdict. The whole pipeline is deterministic, explainable, and
optionally refined by an AI review layer that is **never allowed to fabricate
facts**.

## Pipeline overview

```
GitHub import / demo seed
        │
        ▼
 scan  ──► RepoScanEvidence   (src/lib/scan/evidence.ts)
        │
        ├──► readiness ──► 0..100 + per-factor breakdown   (readiness.ts)
        ├──► remaining work ──► honest hours/days estimate  (estimate.ts)
        ├──► overlaps ──► semantic similarity vs other repos (semantic.ts)
        ├──► productization ──► market/technical assessment  (productize.ts)
        └──► recommendation ──► FINISH | ARCHIVE | MERGE | PRODUCTIZE | OPEN_SOURCE | UNKNOWN
              │                  (recommend.ts, scored by readiness + value + overlap)
              ▼
   AI review (server/ai.ts, model: grok-4.5)
        │   receives STRUCTURED EVIDENCE only, output validated against a zod
        │   schema; any failure → deterministic verdict wins.
        ▼
   Analysis (persisted per repo)  +  immutable snapshot in analysis_runs
```

## Honesty rules

- **No fabricated facts.** Build status, test results, deployment, market
  demand, and remaining work are only reported from what the scanner actually
  observed. `buildStatus`/`testStatus` default to `"unknown"` — the scanner
  never executes the project's code.
- **Confidence is explicit.** Shallow scans (metadata only) report
  `confidence: "low"`. A deep scan (file tree + sampled source) can raise it.
  The AI layer must say `UNKNOWN` when evidence cannot support a recommendation.
- **Productization is unverified by default.** `marketResearched: false` until
  a real market check exists; the pipeline says so in its known-unknowns.
- **Nothing is executed for the user.** `proposed_actions` records an
  "approve"/"decline" decision as *intent only*; Graveyard never performs a
  GitHub write on your behalf.

## Scanners

| Level | Input | Confidence |
| --- | --- | --- |
| Shallow | metadata + root tree + README (import) | low |
| Deep | recursive tree + ~40 sampled source files (deep scan) | medium/high |

Evidence captures structure (tests, CI, deploy, docker, migrations, env config,
workspaces/monorepo), runtime (languages, frameworks, DB, auth, API, frontend,
backend), maturity, unfinished markers (TODO/FIXME/HACK/stubs/placeholders),
and health signals (missing env keys, missing lockfile, stale pins).

## Estimates

`estimate.ts` converts observed signals into an hours range with a label
(`Under 1 hour`, `2–6 hours`, `1.25–2.5 days`, …) plus the factors that drove
it and the unknowns that limit precision. `workToBucket` maps the range to
tiny/small/medium/large/massive for the UI.

## Tonight view

`rankTonight` (`src/lib/scan/tonight.ts`) scores each project by how much a
chosen time budget (30 min … weekend) moves it toward a milestone, weighted by
recommendation, confidence, readiness, and blockers. It surfaces one concrete
next action with a definition of done.

## History

Every analysis is appended as an immutable snapshot (`analysis_runs`): same
commit re-analyzed → a new snapshot with a later timestamp; new commit → a new
snapshot with the new `commit_sha`. Nothing overwrites prior verdicts, so
"what changed since last review?" is always answerable.

## AI review layer

- Endpoint: `api.x.ai/v1/chat/completions`, model `grok-4.5`, temperature 0.2.
- Payload: structured evidence (readiness factors, evidence items, scan stats,
  health, overlaps, estimates) — not a bare repo name.
- Output: strict zod schema; malformed/invalid output → fall back to the
  deterministic decision. Evidence is merged and bounded, never trusted blindly.
- The prompt instructs the model to choose `UNKNOWN` when evidence is
  insufficient.

## Storage

- PGLite (embedded Postgres, in-memory) in preview / when no `DATABASE_URL` is
  set; Neon otherwise. The schema lives in `migrations/*.sql` and is applied to
  both. `0003_history_actions.sql` adds the immutable `analysis_runs` snapshots
  and the approval-gated `proposed_actions` table.
- Built output ships PGLite's WASM assets into the Nitro function bundle
  (`scripts/grok-pglite-wasm.mjs`) so the fallback runs even in serverless.

## Tests

`tests/*.test.ts` run under plain Node (type stripping) and cover the
intelligence layer directly: mature/failing/no-test/near-empty/monorepo/TODO/
README-claim scenarios, duplicates, insufficient evidence, malformed AI output,
merge/validation logic, and immutable history persistence semantics.