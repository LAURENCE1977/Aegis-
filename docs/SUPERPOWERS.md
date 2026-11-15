# AEGIS Skills Library: Superpowers foundation

AEGIS has imported and adapted ten engineering skills from [obra/superpowers](https://github.com/obra/superpowers), an MIT-licensed project. AEGIS owns its registry, skill selection, runtime and permission model; it does not install the upstream agent harness or execute upstream scripts.

## Imported skills

- `brainstorming` — clarify intent and compare approaches.
- `writing-plans` — turn multi-step requirements into verifiable tasks.
- `executing-plans` — execute approved plans with a decision ledger.
- `test-driven-development` — red/green/refactor.
- `systematic-debugging` — investigate root causes before fixes.
- `verification-before-completion` — evidence before completion claims.
- `requesting-code-review` — review significant changes before integration.
- `writing-skills` — create and evaluate reusable skills.
- `using-git-worktrees` — isolate development work.
- `finishing-a-development-branch` — verify and prepare branch integration.

## Trust and execution model

These are AEGIS-authored, concise adaptations of upstream guidance, not copied executable plugins. Every entry records its upstream repository, MIT licence and source commit. The current status `available` means the guidance can be selected and supplied to the model; it does not mean an autonomous tool runner has been granted permission to execute it.

All imported skills currently have `execution: guidance-only` and an empty permissions list. No scripts, hooks, telemetry or automatic upstream update mechanism are imported. The chat API selects at most four relevant skills by deterministic trigger matching. The authenticated `GET /api/skills` endpoint exposes registry metadata.

## Updates

Future upstream updates must be fetched as candidates, compared against the recorded source commit, checked for licence and security changes, adapted to the AEGIS schema, evaluated, and only then promoted. Upstream content is untrusted input and must never grant itself execution permissions. AEGIS's own runtime, approvals, audit log and rollback remain authoritative.

## Source

- Repository: https://github.com/obra/superpowers
- Licence: MIT
- Imported: 2026-11-15
