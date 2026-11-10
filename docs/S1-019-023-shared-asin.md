# S1-019–023: shared US-ASIN review cache

This is the current PR #36 contract. It supersedes the per-user review copies described in earlier integration notes. Team decision: Vincent's PR #36 comments and November 9 Discord discussion; Jerome confirmed ownership of the product-creation hotfix with Christian. Freshness is 14 days after retrieval, never 14 days after reuse.

## What changed

- Products remain user-owned targets, now with a backend-derived `asin`.
- New public Amazon review documents contain `asin`, `cacheVersion`, `reviewId`, normalized review fields, `fetchedAtMs`, `expiresAtMs`, and `createdAt`. New reviews have no userId/productId.
- `reviewCaches/{ASIN}` identifies the active immutable generation and its original fetch/expiry time. A processing lease prevents two targets with the same ASIN from spending provider requests concurrently.
- `ingestionRuns` remain private: userId, productId, ASIN, processing/succeeded/failed status, counts, timestamps, safe error, and the new reuse fields.
- Ownership is verified through the shared ownership helper. A deleting, missing or foreign target returns 404 PRODUCT_NOT_FOUND. Import checks ownership/deletion again before committing reviews.
- Creation, import publication and last-target cleanup coordinate through the cache document. A bare count followed by independent deletion would permit races with new references.
- A stale refresh publishes reviews, cache metadata and run success atomically, then removes the previous generation in bounded batches. Upstream/commit failure preserves the old dataset. Expired data is not returned as fresh. Cleanup failure after success is logged and can leave an inactive generation; it does not undo a committed import. Final-target deletion removes all ASIN generations.

## Service contracts

`createProduct(uid, input, db?)` still returns productId. The ASIN comes from the stored supported URL, never input.asin. The existing product-list response shape is preserved.

`importReviews(uid, productId, { db?, fetchReviews? })` retains the existing signature. Fresh retrieval returns:

```json
{
  "ingestionRunId": "example-run",
  "productId": "example-target",
  "asin": "B07PRVS98X",
  "status": "succeeded",
  "receivedCount": 13,
  "acceptedCount": 13,
  "rejectedCount": 0,
  "savedCount": 13,
  "reviewCount": 13,
  "reused": false,
  "error": null
}
```

A fresh cache hit has `reused: true`, `savedCount: 0`, `receivedCount: 0`, `acceptedCount: 0`, and `reviewCount` equal to the existing dataset size. It records a successful private run, does not call Canopy, and does not extend expiry. acceptedCount counts valid provider records; savedCount may be lower after deduplication by source ID or idless content.

Controllers wrap results in `{ data: result }`. Frontend: use savedCount for newly imported reviews, reviewCount for reused reviews, and reused to select the message. Stored statuses remain `processing`, `succeeded`, `failed`; serialize/map explicitly if the UI uses different labels.

`getReviews(uid, productId, db?)` ownership-checks the selected target and reads only the fresh active ASIN generation in the same transaction. It returns [] for missing/expired cache; an incomplete active generation throws REVIEW_CACHE_INCOMPLETE. It never returns inactive/legacy generations or private ingestion history.

`saveReviews` is now a fail-fast compatibility export: it throws USE_INGESTION_SERVICE. All dataset writes must go through importReviews so metadata and run status cannot diverge. Update old scripts/callers that directly used saveReviews.

`getIngestionRun` and `getIngestionRuns` retain their signatures and private ownership filtering. The list is not a latest-run response and is not ordered/paginated. No new HTTP endpoint was added by this update. Vincent must wire the authenticated import/review/status controllers/routes and agree the latest-run endpoint with Christopher; do not claim that GET ingestion-runs already returns `{ data: latestRun }`.

## Deletion coordination with #12

This package includes the ASIN-aware `deleteProduct` service implementation with the same interface as #12. It does not add or replace #12's GET/DELETE routes or controllers. Coordinate the shared productService.js and test changes when #12 merges; do not blindly select either entire side of a merge conflict.

Deletion rejects a live product import, marks the target deleting, removes that target's private ingestion runs and truly private legacy sample records, and retains ASIN-linked reviews while another target references the ASIN. Last-reference cleanup marks the cache deleting, blocks new product creation/import for that ASIN, deletes review documents in bounded batches, and removes the target/cache last. Failed cleanup is retryable by calling deleteProduct again; a pending cleanup returns REVIEW_CACHE_BUSY to new references.

There is a conservative scan of legacy targets during last-reference cleanup because old products may lack ASIN until migration. This is appropriate for the current small dataset but should be replaced by a completed migration guarantee/reference tracking at larger scale.

## URL scope

Product validation, creation and Canopy use src/utils/amazonSource.js. Supported: HTTPS, exact amazon.com/www.amazon.com, no credentials/nondefault port/ASCII controls, a /dp/<10-character ASIN> or /gp/product/<ASIN> path segment. Tracking parameters and product slugs are accepted. Regional domains, HTTP, bare ASIN backend input and shortened redirect URLs are unsupported. Frontend may convert bare ASIN to a supported URL before submission. ASIN is uppercase; domain is US. No provider URL is fetched from the client directly.

## Migration — review dry-run first

No migration or provider request was run while preparing this update. Keep application writes paused during --apply. Credentials stay in the local backend .env. From apps/backend:

```powershell
node --env-file=.env scripts/migrateSharedReviews.js
```

The default is read-only and prints counts only. After checking the counts, run:

```powershell
node --env-file=.env scripts/migrateSharedReviews.js --apply
```

It backfills products.asin and ASIN/version fields on valid linked legacy real reviews. It excludes the known `test-review-*`/sample-text records from shared promotion, skips unresolved/invalid/mismatched records, preserves document IDs and original ownership links, and is idempotent. It does not delete or automatically publish historical batches. The old records cannot prove the original retrieval time, so they receive an inactive `legacy-unpublished` version with zero expiry rather than being made falsely fresh. One subsequent authorized import creates the active cache; no extra calls are needed for cache-hit checks. Migration performs privileged cross-user maintenance; never expose it as a public route.

## Verification and limits

144 Jest tests across 11 suites passed locally in the preparation environment, including existing main HTTP validation/auth tests adapted to transactional creation. ESLint passed. Tests use mocked Firebase/Canopy and an in-memory Firestore double, not an emulator. Previous live success applies to the old implementation; repeat a controlled live smoke test for this ASIN revision after local installation and integration. CI has not run on this unpushed revision.

The tests cover sharing without extending expiry, isolation, deduplication, expiry refresh, incomplete caches, overlapping ASIN imports, interrupted leases, deletion races, lost commit acknowledgements, atomic failure, provider sanitization, 400-review limits, private history, last-reference cleanup/retry, legacy references, migration exclusions/idempotence and shared URL validation. Mutation checks prove that disabling freshness reuse or deletion protection causes the corresponding behavior tests to fail.

Known limits: at most 400 valid reviews per import; five-minute leases recover on the next import; no background recovery/pagination; interrupted old-generation cleanup may retain inactive data until maintenance or last-target deletion. Deployment across old/new writers is unsupported: coordinate the code/schema cutover and pause writes for migration. The new cache is not Firestore's automatic TTL deletion mechanism.

Official Firestore transaction behavior checked: https://firebase.google.com/docs/firestore/manage-data/transactions and https://firebase.google.com/docs/firestore/transaction-data-contention . All transaction reads precede writes; provider calls remain outside transaction callbacks because callbacks may retry.

## Before merge

- Install on the correct clean branch after merging current main; resolve any #12 overlap deliberately.
- Run backend tests, lint and formatting checks locally; review the complete diff.
- Coordinate #12 deletion service, update PR #36 description and frontend reuse counts/status contract.
- Run the migration dry-run, then a separately reviewed apply with writes paused.
- Perform a controlled live new-import/reuse check and HTTP integration check once routes exist.
- Obtain the two human security reviews required by the team standards.
