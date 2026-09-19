# The Never Contract — public mirror of the checks

[![Never Contract](https://img.shields.io/endpoint?url=https://flicked.email/never/badge.json)](https://flicked.email/never)

The badge is rewritten by each flicked.email deploy from https://flicked.email/never/runs.json — it
reports the last deploy's result and the app commit it ran on, not this minute's state.

This repository is a verbatim copy of two files from Flick's private app repository, published so
the promises at https://flicked.email/never can be inspected rather than taken on trust:

- `never-clauses.json` — the clause register: the 13 numbered promises, which of them are
  CI-enforced (7), and the check each one maps to. The public page and the check runner both
  read this file; https://flicked.email/never.json is generated from it.
- `never-checks.ts` — the executable checks (N1 no streak mechanics, N2 no infinite-scroll
  primitive, N3 no re-engagement pushes, N4 terminus copy honesty, N5 single source of truth).
  They run in the app repository's CI on every push and pull request, and before every deploy of
  flicked.email. The latest result the site was built against is published at
  https://flicked.email/never/runs.json and rendered on https://flicked.email/never.

## Provenance

Copied from the app repository at commit `7bf3f4c670a9f4d41c31b65e2d087a32f01c095b` on 2026-09-19 (see `SOURCE`). The copy is
pushed by the flicked.email deploy pipeline (`scripts/mirror-sync.mjs` in the site repository) right
after each production deploy, so this commit and the one named in the run log should match — compare
the two before trusting either. A copy cannot prove the private CI ran it — that limitation is stated
on the page itself under "Ways this page could still lie".

## Running

The checks scan the app source, so they only run inside the app repository:
`npx tsx scripts/never-checks.ts` from `prototypes/swipe-loop` (add `--json` for the machine-readable
result). They cannot run from this mirror alone.

Published for inspection. © Belkins; not licensed for reuse.
