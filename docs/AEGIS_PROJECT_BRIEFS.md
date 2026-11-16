# AEGIS Project Space handover briefs

`GET /api/workspaces/:id/brief` creates a bounded, owner-authenticated handover brief for one active Project Space.

The brief includes:
- the workspace name, status and goal;
- recent event summaries only (never raw event bodies);
- accepted, non-restricted, unexpired memories belonging to the same owner and project;
- source attribution and timestamps without source URLs or raw provenance payloads;
- a hard 1,000–12,000 character budget and estimated token count.

Memories are ordered by decision, procedure, fact, event, artifact and preference priority, then confidence and recency. Individual memory text is capped at 1,200 characters and the budget reports both omitted and shortened content.

Every included event and memory is marked `untrusted-reference`. The brief explicitly states that it is context, not instructions, permissions or authoritative execution state. Candidate, rejected, expired, restricted and cross-project memories are excluded.

This is a read-only composition endpoint. It does not execute tools, call a model, change memory status or deploy/provision D1.
