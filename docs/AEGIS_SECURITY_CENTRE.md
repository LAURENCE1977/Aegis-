# AEGIS Security Centre

The minimal Security Centre in the browser exposes one explicit, owner-controlled workflow:

1. Inspect the approved local module-catalogue capability in the registry.
2. Create a 24-hour exact-resource grant for `aegis-module-catalogue:list` on `aegis:modules`.
3. Review active grants and revoke them.
4. Manually invoke the fixed local read-only catalogue through Sentinel and display its invocation ID, audit status and output.

The UI does not create a grant or invoke a capability on page load. Both actions require an explicit button press. It never accepts a user-selected adapter, provider, URL, MCP server, shell command, browser action or write operation.

Grant management and invocation require configured owner authentication and the AEGIS D1 migrations. If storage is unavailable, the UI reports that state and does not fall back to an unsafe mode. A grant remains distinct from a human approval; this first read-only action does not authorize any external or consequential action.
