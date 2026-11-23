# AEGIS merge-toolkit integration plan

This document records the role and safety boundary for the five external Git tools requested for AEGIS. They complement the merge-readiness analyser; they are not interchangeable and must not all be enabled as merge bots.

## Tool selection

| Tool | Intended AEGIS role | Integration boundary |
| --- | --- | --- |
| [Mergify](https://github.com/Mergifyio/mergify) | Preferred future merge queue: rebuild queued PRs against the actual target branch and run required CI on the combined candidate | Requires an owner-installed GitHub App and explicit repository/ruleset configuration. Do not enable until branch protections and required checks are audited. |
| [Kodiak](https://github.com/chdsbd/kodiak) | Alternative PR updater/automerge bot | Do not run as a competing merge controller alongside Mergify. If selected instead, require an explicit opt-in label and all GitHub required checks; keep auto-merge off for draft and WIP PRs. |
| [Mergiraf](https://codeberg.org/mergiraf/mergiraf) | Optional syntax-aware local merge driver for supported file types | Developer/CI environment only where the binary is installed and pinned. Review every automatic resolution. Never assume GitHub's server-side merge uses a developer's local merge driver. |
| [delta](https://github.com/dandavison/delta) | Human-readable, side-by-side diff and conflict review | Developer workstation/diagnostic environment only; it changes diff presentation, not merge semantics. |
| [git-filter-repo](https://github.com/newren/git-filter-repo) | Exceptional history cleanup or repository extraction | Not a normal merge-conflict resolver. Only in a disposable mirror/clone with a written ref map, backup and explicit owner approval; never rewrite the live AEGIS repository or force-push as routine repair. |

## Recommended operating sequence

1. Use the AEGIS Merge Intelligence analyser to inventory PR bases, ancestry, dependency stacks, changed-file overlap and GitHub's mergeability signal.
2. Inspect the actual three-way diffs. Use delta for human review where available.
3. For supported syntax-aware files, optionally reproduce a conflict in an isolated clone with Mergiraf installed. Review the result and retain a normal manual-resolution fallback.
4. Update/rebase dependent branches in a disposable work branch, one stack at a time. Run the full test suite and migration checks against the resulting combined tree.
5. Only after the owner approves a merge controller, use exactly one of Mergify or Kodiak. Require successful CI and branch protection; do not auto-approve or auto-merge AEGIS feature PRs by default.

## Current AEGIS safeguards

- No merge bot is enabled by this change.
- No Mergify/Kodiak GitHub App is installed or configured by this change.
- No Git history rewrite, force-push, branch deletion, PR retargeting or merge is performed.
- Mergiraf is not declared as a repository-wide merge driver: a custom driver must exist on every machine doing the merge, and a missing driver can break normal merge operations.
- The existing merge-readiness engine reports overlapping paths as review risk, not proof of a textual conflict.

## Configuration examples (reference only)

Mergify queue configuration must be validated against the exact required-check names and rulesets before use. Do not commit an active queue policy until the GitHub App is installed and the owner has selected Mergify over GitHub's native queue/Kodiak.

Kodiak requires a .kodiak.toml and GitHub branch protection. Its default label-gated behavior is safer than unrestricted auto-merge, but the repository must still explicitly decide whether to use it.

For local diff inspection, delta supports side-by-side diffs, line numbers and improved conflict display. For local structural merges, follow Mergiraf's upstream installation and registration instructions and pin a reviewed version.

git-filter-repo --analyze can help inspect repository history, but even analysis output should be run on a disposable clone. Actual filtering rewrites commit IDs and can invalidate branches and references; it is not appropriate for the current PR base-drift problem.


## Implemented read-only diagnostics and Mergiraf lab

The merge-intelligence branch now includes two isolated CI workflows:

- `.github/workflows/merge-diagnostics.yml` runs on pull-request updates. It reads open PR metadata, narrows the scan to the connected feature/repair branch stack, compares each base/head pair, collects changed paths, and writes an advisory review summary. The repository default branch is deliberately excluded as a graph bridge so unrelated PRs are not swept into one giant stack. The workflow uses read-only GitHub permissions and never writes PRs or branches.
- `.github/workflows/mergiraf-sandbox.yml` installs the pinned Mergiraf **0.20.0** release and runs `scripts/mergiraf-sandbox.sh`. The script creates a disposable temporary Git repository, reproduces a YAML structural conflict, invokes `mergiraf solve`, verifies the exact expected result and removes the temporary repository. It never checks out, modifies or commits AEGIS project files.

The repository does **not** register Mergiraf as a global or tracked `.gitattributes` merge driver. The CI smoke test proves the pinned tool can resolve a known fixture; it does not claim that it has resolved any live AEGIS PR conflict. Any future real-branch use must happen in a disposable worktree, with the proposed patch reviewed and the complete test suite run before a human-approved branch update.

The diagnostics report treats changed-file overlap as a review warning only. GitHub's mergeability state remains a separate signal and may mean a confirmed conflict or an unresolved calculation; it must be inspected before action.
