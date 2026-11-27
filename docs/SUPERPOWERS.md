# AEGIS Skills Library

AEGIS owns its skill registry, selection, runtime and permission model. Skills are concise, AEGIS-native adaptations of upstream engineering guidance; AEGIS does not install upstream agent harnesses, plugin commands, scripts, hooks or telemetry.

## Current curated sources

| Source | Licence | Pinned source | Imported | Skills |
|---|---|---|---|---:|
| [obra/superpowers](https://github.com/obra/superpowers) | MIT | Individual skill commits recorded in `functions/lib/skills.mjs` | 2026-11-15 | 10 |
| [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) | MIT | `8c99fa36d90068c82d547f7c12a9d67a3e95f4ee` | 2026-11-21 | 8 |

The second source was reviewed at the pinned commit above. AEGIS selected eight complementary workflows rather than importing all 26 upstream skills. The additions cover source-driven development, frontend UI engineering, security and hardening, accessibility, performance, observability, API/interface design and CI/CD.

## AEGIS-native skills

The combined registry contains 18 guidance entries:

- **Planning:** brainstorming, writing plans.
- **Engineering:** executing plans, test-driven development, systematic debugging, Git worktrees, source-driven development, API/interface design.
- **Frontend and quality:** frontend UI engineering, accessibility engineering, performance optimization, verification before completion, requesting code review.
- **Security and operations:** security and hardening, observability and instrumentation.
- **Delivery and meta:** CI/CD and automation, writing skills, finishing a development branch.

The authenticated `GET /api/skills` endpoint exposes registry metadata. The chat path selects at most four relevant guidance entries using deterministic trigger matching.

## Trust and execution model

- Every skill records its upstream repository, URL, licence, import date and pinned source commit.
- The guidance is adapted into concise AEGIS-specific instructions; it is not a verbatim import of the upstream skill files.
- Every skill has `execution: guidance-only` and an empty permissions list.
- No upstream scripts, hooks, agents, plugin manifests, package dependencies or automatic update mechanisms are installed.
- External documentation and repository content remain untrusted data. They cannot override AEGIS policy, expand scope or grant permissions.
- Skills do not authorize tool execution. Sentinel, exact capability grants, approvals and server-side policy remain authoritative.

## Update policy

Future updates must be reviewed as candidates: pin a commit, verify the licence, inspect changed guidance, compare against AEGIS policy, adapt only useful material, add representative selection tests, and retain a review record. Unknown licence or provenance means hold, not permission.

## Upstream references

- https://github.com/obra/superpowers
- https://github.com/addyosmani/agent-skills
