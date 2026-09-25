---
applyTo: "**"
---

# jnibarger01 pull-request merge gate

When reviewing a pull request authored by `jnibarger01`, treat the review as a merge-safety gate.

- Inspect the complete diff, the PR description, and any linked issue or context that is available.
- Check correctness, security, regressions, and whether the changes stay within the stated scope.
- Treat authentication, authorization, secret handling, data loss/corruption, destructive migrations, deployment behavior, concurrency, and privilege-boundary changes as high-risk areas.
- Verify that tests adequately cover changed behavior where tests are applicable. Flag missing regression coverage when it creates material risk.
- Flag scope creep, unrelated edits, hidden behavior changes, or weakened safeguards.
- Prefer concrete, actionable findings tied to changed code. Do not create style-only or speculative blocking comments.
- Create an inline review comment for every material finding that should block merge. A clean review should not invent concerns.
- The merge gate only sees blocking findings as unresolved inline threads. If a blocking finding cannot be anchored to a changed line (for example, a missing file, missing test, or cross-cutting design issue), include the literal token `MERGE-BLOCKER` followed by the finding in the review summary. Never use that token for non-blocking notes.
- Do not suggest bypassing required checks, force-pushing around protections, dismissing legitimate review findings, or weakening security/branch protections merely to make the PR mergeable.
