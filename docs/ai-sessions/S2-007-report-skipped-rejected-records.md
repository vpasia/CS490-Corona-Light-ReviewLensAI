# S2-007: Report Skipped or Rejected Review Records (frontend)

- **Tool:** Claude (claude.ai)
- **Date:** 2026-11-19
- **Ticket:** S2-007
- **Branch:** S2-007-report-skipped-rejected-records

## Prompts and responses (trimmed)

### 1. Building the skipped-records report
**Prompt (summary):** Asked Claude to start S2-007 after S2-005 (import status card) was finished.
**Response (summary):** Claude used the counts the backend already saves on each ingestion run (`rejectedCount`, `acceptedCount`, `savedCount`, `reviewCount`, `reused`). It added `runCounts.js` (turns a saved run into display numbers, returning nothing when a count is missing or invalid), `ImportResultCounts.jsx` (shows reviews saved, skipped records in a warning color, and duplicates left out, with separate wording for reused and failed imports), and two small edits to `IngestionStatusCard.jsx` to show it under the import status. Because of the earlier S2-005 mistake, it gave small targeted edits and new files instead of replacing whole files. Tests cover the count logic, the component, and the card wiring. Code omitted; see the PR files.

## What was kept, changed, or rejected
- **Kept:** all new files and tests, after I read them and could explain them. I tried it by hand in the running app.
- **Changed:** nothing beyond running Prettier.
- **Not done:** reason categories for skipped records (the backend does not store a reason per record, only counts) and any backend change.
- **Assumption to confirm with the backend owners:** for a reused import the run records zeros, so the card says saved reviews were reused instead of "0 skipped".
- **Secrets / user data:** none included.