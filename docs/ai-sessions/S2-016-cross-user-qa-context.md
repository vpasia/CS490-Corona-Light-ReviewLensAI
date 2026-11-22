# S2-016 — Keep other users' reviews out of Q&A context

## Shared route integration — November 21, 2026

Codex replaced the earlier service-composition test with checks at the authenticated `/analyze` route. The merged QA service already uses the ownership-checked loader. The route tests seed distinct active review caches for two owners and mock Firebase token verification and Gemini HTTP responses. The real route, context loader, service, and adapter run in the tests.

A foreign-target request returns the same HTTP 404 as a missing target. The test verifies that only product lookups occurred and that neither token counting nor generation was called, even when the body supplied another UID and ASIN. Each owner can analyze their own target. The captured provider request contains that target's review and excludes the other dataset. A signed-in browser run against a test account remains pending.

Backend lint and all 250 coverage tests passed. Line coverage was 93.80% and branch coverage was 90.73%.

**Tool and date:** Codex, November 20, 2026

**Request:** Implement [issue #59](https://github.com/vpasia/CS490-Corona-Light-ReviewLensAI/issues/59). Use two synthetic users and capture the payload at a mocked model boundary to verify review isolation.

**Initial implementation:** Before the shared route landed, `reviewQaOwnership.test.js` used the in-memory Firestore double, the ownership-checked `getReviewDataset` loader, `getOwnedProduct`, and the real `buildReviewQaRequest`. The two users owned targets with different Amazon ASINs and distinctive synthetic review phrases. The authenticated route tests above now replace that service-composition test.

**What the tests proved**

- A request from User B for User A's target is rejected with `404 PRODUCT_NOT_FOUND`. The loader stops at the product lookup, before touching the review cache or calling the model mock.
- For owned targets, the mock receives exactly the selected target's review in the evidence field, with the matching product name and Amazon platform. User B's question asks about User A's product, yet User A's distinctive review phrase is absent from the entire model payload. The test also checks the other direction.

Backend lint passed. All 192 tests passed with 92.77% statement, 91.30% branch, 91.46% function, and 92.65% line coverage. Temporarily removing the ownership comparison made the foreign-target test fail. Restoring it made the test pass again.

**Branch and dependency:** Fetched the remote refs and checked the current branch and `origin/main` at `3421bab`. The shared backend `/analyze` route was absent. The token-bounded `buildReviewContext` service is on `origin/main` and uses the same `getReviewDataset` loader. Keeping the tests on the existing draft branch preserved the earlier session edits and the Git-ignored interactive runner.

**Pending:** When the shared endpoint lands, repeat both paths through authenticated `POST /api/products/:productId/analyze` requests. Verify that the verified token supplies the UID, a foreign target returns HTTP 404 before token counting or generation, and captured payloads for every context batch and any synthesis contain only the authorized reviews.
