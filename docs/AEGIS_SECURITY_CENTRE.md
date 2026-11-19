# AEGIS Security Centre

The minimal Security Centre in the browser exposes one explicit, owner-controlled workflow:

1. Inspect the approved local module-catalogue capability in the registry.
2. Create a 24-hour exact-resource grant for `aegis-module-catalogue:list` on `aegis:modules`.
3. Review active grants and revoke them.
4. Manually invoke the fixed local read-only catalogue through Sentinel and display its invocation ID, audit status and output.

The UI does not create a grant or invoke a capability on page load. Both actions require an explicit button press. It never accepts a user-selected adapter, provider, URL, MCP server, shell command, browser action or write operation.

Grant management and invocation require configured owner authentication and the AEGIS D1 migrations. If storage is unavailable, the UI reports that state and does not fall back to an unsafe mode. A grant remains distinct from a human approval; this first read-only action does not authorize any external or consequential action.


## Composio GitHub read-only controls

The Security Centre also provides owner-triggered, Sentinel-gated reads through a narrowly allowlisted Composio GitHub session:

- Repository metadata for one exact repository.
- Pull-request metadata for one exact pull request.
- At most ten workflow-run summaries for one exact repository and optional branch.
- At most twenty job summaries and bounded step summaries for one exact workflow run.

Each action has a separate capability manifest, grant scope and exact resource identifier. The owner-facing buttons only prepare a grant; the owner must review and submit the grant separately before a read can succeed. The UI does not create grants on page load or invoke external reads automatically. Read buttons remain disabled until the Composio connection is active.

The Composio session is pinned to four fixed read-only GitHub tools. Existing older sessions must be reconnected to enable newer tools. Workflow/job logs, artifacts, workflow dispatch, reruns, cancellation, repository writes, shell, MCP and arbitrary tool selection remain unavailable. See `AEGIS_COMPOSIO_GITHUB_READONLY.md` for the exact adapter contracts and limits.
