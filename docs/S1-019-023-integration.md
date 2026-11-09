# S1-019 / S1-023: Review ingestion coordination and result state

## Implementation

`ingestionService.js` coordinates an owned product import and persists its result in `ingestionRuns`. It reuses Canopy retrieval, normalization, ownership and the shared review-write helper.

The service starts a run as `processing`, then fetches outside any database transaction. It commits accepted review writes, the `succeeded` run status and lock release in ONE Firestore transaction. A failed final transaction cannot leave a successful run without its reviews. Failure records contain safe error information and savedCount 0; existing reviews are not deleted or replaced.

The existing reviewService now uses reviewWrites.js for shared validation and write staging. Existing public signatures and the 400-review save limit are retained. Canopy errors are now AppError instances so central error middleware recognizes them; provider-specific codes remain useful for direct callers and are mapped to standard UPSTREAM_PROVIDER_ERROR by the coordinator.

## Public service functions

```js
import { importReviews, getIngestionRun, getIngestionRuns } from './services/ingestionService.js';

// Controller must pass verified req.user.uid, never a submitted userId.
const result = await importReviews(uid, productId);
const run = await getIngestionRun(uid, productId, result.ingestionRunId);
const runs = await getIngestionRuns(uid, productId);
```

`importReviews` options support `{ db, fetchReviews }` for isolated tests. Controllers should use default dependencies, not accept these options from requests. UID is supplied by the caller after authentication; these service functions do not verify an HTTP token themselves.

The request must reference an existing product. The source is the saved product.amazonUrl; callers cannot inject a different import URL. Unsupported/missing sources and missing/foreign targets are rejected before provider processing. Failed admission/validation does not create a run.

Example successful INTERNAL service result:

```json
{
  "ingestionRunId": "generated-run-id",
  "productId": "owned-product-id",
  "status": "succeeded",
  "receivedCount": 13,
  "acceptedCount": 13,
  "rejectedCount": 0,
  "savedCount": 13,
  "error": null
}
```

Each stored run additionally has userId, startedAt and completedAt Firestore timestamps. Empty/all-invalid results become failed runs with NO_VALID_REVIEWS. Mixed results succeed when valid reviews are actually saved, with rejectedCount retained. More than 400 accepted reviews fail without partial writes.

## Controllers / frontend handoff

The documented import action is POST /api/products/:productId/import-reviews. This implementation waits for completion, returning a result or throwing AppError; it is not a detached background job. The controller should wrap success as `{ data: result }` with HTTP 200 and allow errors to reach the shared middleware. Importing reviews here is an action on an existing product, unlike product creation's HTTP 201.

Proposed status routes for team confirmation (NOT implemented by this package):
- GET /api/products/:productId/ingestion-runs -> getIngestionRuns
- GET /api/products/:productId/ingestion-runs/:ingestionRunId -> getIngestionRun

Controllers must serialize timestamps and use the standard data envelope. The run-list service returns all matching runs, unsorted and without cursor pagination; do not invent count/cursor behavior in the frontend. UI should handle no runs as not yet imported. It can show a local loading state during POST, then success/error and refreshed reviews. A failed POST must not be automatically retried: reread stored status first if the outcome is uncertain.

No routes/controllers or frontend changes are included. Vincent/team owns route integration. Request/proxy timeouts must allow the 60-second Canopy timeout plus database work.

## Concurrent imports and recovery

A transaction checks product ownership, validates its source, creates a processing run and sets product.activeIngestionRunId with ingestionLockUntil (server-process Unix milliseconds). Concurrent admission within a 5-minute lease returns 409 INGESTION_IN_PROGRESS before another provider call. Ownership and the active run are rechecked at the final transaction.

If a process dies, its run can remain processing. Once the lease expires, the NEXT import marks that previous run failed with INGESTION_INTERRUPTED and starts a new run. No timer/background recovery worker is implemented; the status does not change automatically at five minutes. A superseded old request cannot persist reviews or clear a newer run's lock.

If failure-status persistence is unavailable, callers receive 500 INGESTION_STATE_UNAVAILABLE and should check stored status before retrying. If a success committed but its acknowledgement was lost, recovery recognizes the persisted success. Logs contain event, identifiers and safe codes, never raw error messages, credentials or review text. They use the existing allowed console.error path; adopt the team's centralized logger when available.

Run lookup checks product ownership and run ownership/product association. Lists filter by BOTH userId and productId. Separate users' records are never shared. Successful repeat imports still create new review IDs, following #22's existing duplicate behavior.

## Validation

21 new Jest tests passed locally in the assistant environment. With existing Canopy (11) and review persistence (20) tests, 52 focused tests passed. New/changed JS files passed Node/recommended ESLint rules with the team's console allowances and were formatted using committed backend Prettier settings.

Coverage includes source validation, processing/success/failure, same-owner target isolation, foreign/missing targets before provider access, missing identity, mixed/empty/invalid review collections, safe provider failures, transaction rollback, lost acknowledgement, failed status persistence, overlapping requests, expired-run recovery, ownership recheck and batch size rejection.

Tests mock Firebase initialization/timestamps and use a transactional fake database. No real Firebase/Canopy calls, CI run or GitHub mutations were performed to validate this package. The previously reported live #20-22 test predates this coordinator and does NOT verify it.

After installation, run from apps/backend:

```powershell
npm test -- --runInBand
npm run lint
```

With the previously reported 56-test baseline, expect 77 total unless team changes add more tests. Confirm the actual output. Follow with a controlled live test of importReviews and stored run retrieval, then authenticated route/UI integration testing and CI. Keep .env private.
