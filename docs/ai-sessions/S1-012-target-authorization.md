# S1-012 AI-assisted development record

- Tool: OpenAI Codex
- Date: 2026-11-08
- Ticket: S1-012, cross-user AnalysisTarget authorization
- Branch: `feature/S1-012-cross-user-target-authorization`

## Relevant prompt and response

> Developer: "$superpowers:brainstorming Lets brainstorm a design/plan for ticket 12, read all for docs/ files to get a better understanding of engineering standards, read / look through current branch rn and main as well. Also read the section regarding S1-012 in Sprint1Issues.csv"

> Developer: "No the plan shouldn't use an isolated worktree it should work on the created feature/S1-012-cross-user-target-authorization branch, make sure code is simple and to not over engineer"

> Developer: "There should be no commiting for the AI agent"

> Developer: "Implement the plan."

> Codex: "I’ll check whether S1-011 has merged, read the current docs and backend files, then implement S1-012 on the requested feature branch. I’ll leave all changes uncommitted."

> Codex: "S1-011 is on `origin/main`, so the dependency is met. I’m creating the S1-012 branch from updated main now, while preserving the unrelated uncommitted files."

The tests use two fake Firebase identities and in-memory Firestore behavior. The first run of the new GET tests failed because the route was absent; the first DELETE run failed because the route and service were absent. Both passed after implementation.

## What was kept, changed, or rejected

- Kept: S1-011's verified-token UID, product route, service structure, and `getOwnedProduct` helper.
- Changed: Added owner-only GET and DELETE endpoints. DELETE queries reviews and ingestion runs by both `userId` and `productId`, deletes them in Firestore batches of at most 400 writes with the product in the last batch. A small middleware rejects decoded product IDs containing a slash with `400 VALIDATION_ERROR`.
- Rejected: A new authorization abstraction, update endpoint, frontend changes, dependencies, live Firebase access, and commits by the AI agent.

## Review notes

- Missing and foreign products use the same `404 PRODUCT_NOT_FOUND` response. Tests prove user B cannot retrieve or delete user A's product and that A can still retrieve it afterward.
- A requested code review identified one-write-per-child latency and partial deletion after a later failure. Tests reproduced the batch failure cases before the service changed to bounded batches. For more than 400 documents, a failed later batch can leave some children removed while the product remains; retrying the DELETE finishes the cleanup.
- Authorization and Firestore data access require the security checklist and two human approvals under AI-29 before a PR is approved.
- No real tokens, credentials, or user data were used.

## November 9 integration follow-up for PR #36

A teammate asked that deletion coordinate with active imports and clean up ingestion-run records. The product deletion service now uses a Firestore transaction to reject an active import lease with `409 INGESTION_IN_PROGRESS` and mark the product `deleting: true` before querying children. It deletes matching `ingestionRuns` with reviews, filtered by both `userId` and `productId`. Failed deletion batches leave the marker and product available for retry.

The team subsequently confirmed that there is no `analyses` collection. Its deletion query and test fixtures were removed, and the engineering and security standards were updated to describe the current collections.

PR #36 is still separate. Its import admission and completion transactions must reject a product with `deleting: true` before writing a new run or reviews. Because those transactions also read and update the product document, this guard closes the race between import and deletion when the branches are integrated. Until that counterpart is merged, the deletion marker alone cannot stop a new import from starting after deletion begins.
