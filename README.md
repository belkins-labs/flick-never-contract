# The Never Contract — public mirror of the checks

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

Copied from the app repository at commit `75f6a7ad7276da9ee93960eb416a791b4279ebef` (see `SOURCE`). The mirror is refreshed by hand
when the checks change; the run log names the commit it ran against, so compare the two before
trusting either. A copy cannot prove the private CI ran it — that limitation is stated on the
page itself under "Ways this page could still lie".

## Running

The checks scan the app source, so they only run inside the app repository:
`npx tsx scripts/never-checks.ts` from `prototypes/swipe-loop` (add `--json` for the machine-readable
result). They cannot run from this mirror alone.

Published for inspection. © Belkins; not licensed for reuse.
