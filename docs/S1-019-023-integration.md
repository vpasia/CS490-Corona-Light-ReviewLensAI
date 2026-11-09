# S1-019 / S1-023: Ingestion Coordination and Result State

## Implemented scope

ingestionService.js coordinates review imports for user-owned products
and records their results in the ingestionRuns collection.

The service performs:

1. Identity and product identifier validation.
2. Product ownership verification.
3. Validation of the product's saved Amazon URL.
4. Creation of a processing run and an import lock.
5. Review retrieval through Canopy.
6. Review normalization.
7. Atomic persistence of accepted reviews and the successful run state.
8. Safe failure recording when an import cannot complete.

The provider request occurs outside Firestore transactions because
Firestore can retry transaction callbacks.

## Related service changes

reviewWrites.js contains shared review validation and write-staging
logic used by reviewService.js and ingestionService.js.

The existing reviewService public functions remain available:
- saveReviews
- getReviews

The 400-review save limit is retained.

Canopy errors now use the team's AppError class. Provider-specific
codes remain available to direct callers. The ingestion coordinator
maps provider failures to the standard UPSTREAM_PROVIDER_ERROR code.

No new dependencies or environment variables are introduced.

## Public service interface

```js
import {
    importReviews,
    getIngestionRun,
    getIngestionRuns
} from './services/ingestionService.js';

const result = await importReviews(uid, productId);

const run = await getIngestionRun(
    uid,
    productId,
    result.ingestionRunId
);

const runs = await getIngestionRuns(uid, productId);
```

Adjust relative imports for the caller's location.

Controllers must supply uid from verified req.user.uid. A userId from
the request body must never establish ownership.

These service functions do not verify HTTP tokens themselves.

importReviews accepts optional db and fetchReviews dependencies for
isolated tests. Controllers must not accept these dependency options
from client requests.

The source URL comes from the owned product's amazonUrl field.
The import request cannot override it with another URL.

## Admission checks

Before a provider request begins, the service checks:

- A usable user ID is supplied.
- The product identifier is valid.
- The product exists.
- The user owns the product.
- The saved Amazon URL is supported.
- Another active import does not hold the product's lock.

Missing or foreign products return 404 PRODUCT_NOT_FOUND.

An overlapping import returns 409 INGESTION_IN_PROGRESS before
another provider request is made.

Rejected admission or source validation does not create an ingestion
run.

## Stored ingestion state

Each ingestionRuns document includes:

- ingestionRunId
- userId
- productId
- status
- receivedCount
- acceptedCount
- rejectedCount
- savedCount
- startedAt
- completedAt
- error

Supported stored statuses:

| Status | Meaning |
| --- | --- |
| processing | Import started and has not recorded a final result |
| succeeded | Accepted reviews and successful status were committed |
| failed | The attempt recorded a failure |

Example successful internal service result:

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

Stored runs additionally contain ownership and Firestore timestamps.

Empty results and entirely invalid review collections become failed
runs with NO_VALID_REVIEWS.

Mixed valid and invalid collections can succeed when accepted reviews
are actually saved. rejectedCount preserves the rejected total.

More than 400 accepted reviews fail without partial persistence.

## Atomic persistence

The final Firestore transaction:

1. Rechecks product ownership.
2. Confirms the run is still active.
3. Stages accepted review documents.
4. Updates the run to succeeded.
5. Records completion time.
6. Releases the product's import lock.

These writes commit together. The transaction cannot record success
without committing the associated review writes.

Existing valid reviews are not deleted or replaced on failure.

Successful repeated imports currently create additional review
documents. Duplicate suppression remains deferred under S1-022.

## Failure handling

Stored and user-visible failure information uses safe codes and
messages. Raw provider errors, credentials, and review text are not
included.

Provider failures become 502 UPSTREAM_PROVIDER_ERROR.

Other handled outcomes include:
- NO_VALID_REVIEWS
- VALIDATION_ERROR
- PRODUCT_NOT_FOUND
- INGESTION_SUPERSEDED

Unexpected errors become INTERNAL_ERROR with a generic message.

If recording the final failure state is unavailable, the service
throws 500 INGESTION_STATE_UNAVAILABLE. The caller should check the
stored run state before retrying.

If the successful transaction committed but its acknowledgement was
lost, recovery recognizes the persisted succeeded state rather than
overwriting it as failed.

Logs contain an event name, identifiers, and safe codes. They use the
existing allowed console.error path. Adoption of a centralized logger
remains integration work.

## Concurrent imports and recovery

Admission uses a transaction to create the processing run and set:

- product.activeIngestionRunId
- product.ingestionLockUntil

The lock has a five-minute lease based on server-process Unix time.

If a process stops unexpectedly, its run may remain processing.
After the lease expires, the next import attempt marks the previous
processing run failed with INGESTION_INTERRUPTED and starts a new run.

There is no background recovery worker. Expired runs do not change
status automatically after five minutes.

An old, superseded request cannot save reviews or release a newer
run's lock.

## Ownership of status reads

getIngestionRun verifies:
- The caller owns the product.
- The run belongs to that user.
- The run belongs to the requested product.

Missing or mismatched runs return 404 INGESTION_NOT_FOUND after the
product ownership check.

getIngestionRuns checks product ownership and filters by both userId
and productId.

The list currently returns all matching runs without guaranteed order
or cursor pagination.

## Controller and frontend handoff

The documented import action is:

POST /api/products/:productId/import-reviews

The coordinator waits for completion and returns a result or throws
AppError. It is not a detached background worker.

The controller should:
- Pass verified req.user.uid and productId.
- Call importReviews.
- Return HTTP 200 with { data: result } on success.
- Forward errors to the central error middleware.

The import action operates on an existing product. Product creation
continues to use HTTP 201 separately.

Proposed status routes for team confirmation:

- GET /api/products/:productId/ingestion-runs
- GET /api/products/:productId/ingestion-runs/:ingestionRunId

These status routes are proposals; this package does not implement
HTTP routes or controllers.

Controllers must serialize timestamps and use standard response
envelopes. Pagination behavior must be agreed before exposing cursors.

The frontend can show:
- Not imported when no runs exist.
- Loading while the import POST is pending.
- Success after a successful result.
- A safe error after failure.

On completion, the frontend should refresh stored reviews and status.

Request and proxy timeouts must allow the 60-second Canopy timeout
plus database work.

Do not automatically repeat a failed or timed-out import request.
Check its stored outcome first.

## Automated verification

The complete backend suite passed locally:

```powershell
npm test -- --runInBand
npm run lint
```

Results:
- 6 test suites passed.
- 77 tests passed.
- Backend lint passed.

The suite includes 21 new ingestion tests.

Coverage includes:
- Processing and successful completion.
- Source and identity validation.
- Foreign or missing products before provider access.
- Normalization of mixed review collections.
- Empty and entirely invalid collections.
- Sanitized provider failures.
- Atomic write rollback.
- Recovery after a lost success acknowledgement.
- Failure-state persistence errors.
- Blocking overlapping imports.
- Recovery of expired runs on a later request.
- Ownership rechecks before persistence.
- Rejection of oversized imports.
- Run isolation between users and products.

Automated tests use mocked Firebase configuration and timestamps,
transactional fake database behavior, and simulated provider results.
They make no live Canopy or Firebase requests.

Changed JavaScript files were formatted using the repository's
backend Prettier settings.

Local results do not establish the current GitHub CI status.

## Live coordinator verification — November 8, 2026

Called importReviews using real Canopy and Firestore, then retrieved
the stored ingestion run and newly added review documents.

The check verified the Firebase user exists before calling the
service. This is separate from HTTP token authentication.

Results:

| Stage | Count |
| --- | --- |
| Received | 13 |
| Accepted | 13 |
| Rejected | 0 |
| Saved | 13 |
| Newly stored reviews verified | 13 |

The stored run status was succeeded, with a completion timestamp.

Newly saved reviews had the expected userId and productId.

The check identified newly added reviews by comparing their database
IDs before and after the import.

This verifies the coordinator through direct service calls against
real providers. The new review records and ingestion run remain in
Firestore for inspection.

Previous sample reviews and earlier imported reviews also remain
under the test product.

The successful manual check did not exercise live failure recovery,
concurrent requests, or cross-user HTTP access. Those behaviors are
covered by isolated automated tests and require integration testing.

## Remaining integration work

- Connect authenticated controllers and routes.
- Confirm and implement the status endpoint contract.
- Serialize timestamps and agree on pagination behavior.
- Connect the frontend ingestion button and status display.
- Test authenticated HTTP success, failure, and ownership isolation.
- Confirm current GitHub CI results.
- Complete team review before merging.