# S1-022: Persist reviews with target ownership

## Scope and model

The service follows the current user-owned products model. Each root `reviews` document stores a generated reviewId, trusted userId, productId, a server-created createdAt timestamp, and allowlisted normalized review fields. The existing getOwnedProduct helper verifies target ownership. No provider request is made here.

## Service interface

```js
import { saveReviews, getReviews } from './services/reviewService.js';

// uid must come from verified req.user.uid, never the request body.
// acceptedReviews is the accepted list from normalizeReviews.
const saved = await saveReviews(uid, productId, acceptedReviews);
// saved: { reviewIds: ['generated-id'], count: 1 }
const reviews = await getReviews(uid, productId);
// reviews: array of stored records, not an HTTP response wrapper.
```

Relative import paths depend on caller location. Both functions accept an optional final database argument for isolated tests; otherwise getDb resolves the configured backend database. They validate uid before initializing Firebase.

Both functions check product ownership. Missing/foreign products produce the shared 404 PRODUCT_NOT_FOUND response. Retrieval filters by both userId and productId. Client/source ownership, IDs, timestamps and unsupported properties are discarded on save. Data is validated again using the normalizer; invalid records reject the whole save rather than silently dropping records. Empty saves still check ownership and return count 0 without a commit. This is not a successful ingestion declaration.

Each call accepts at most 400 reviews and commits one atomic write batch. This explicit Sprint 1 bound covers our verified 13-review import. Larger batches return 400 VALIDATION_ERROR before writes; orchestration must not silently truncate them. Database write failures propagate and no successful count is returned. Separate multi-batch ingestion and lifecycle races involving concurrent deletion are not implemented here.

sourceReviewId is preserved when available so duplicates can be identified later. Each save currently generates fresh Firestore IDs; repeat imports can create duplicates. Sophisticated duplicate resolution is deferred as permitted by #22.

## Controller integration

Vincent's controllers/routes supply the verified uid, invoke the service, and wrap list output using the standard `data` envelope. Firestore Timestamp serialization, pagination/cursors and HTTP error middleware remain controller/integration work; getReviews currently retrieves all matching records without pagination or guaranteed ordering. No public HTTP endpoint is added in this package. Unknown database errors must be sanitized by error middleware.

S1-019 coordinates source submission/import; S1-020 fetches; S1-021 normalizes; S1-022 saves accepted records; S1-023 records the final result only after save completion. Existing getOwnedProduct and AppError are reused. No package or configuration changes are required.

## Tests and verification

20 new Jest tests passed in the assistant's isolated environment using the existing normalizer and the current ownership helper/AppError. Firebase configuration and timestamp generation are mocked; a fake database records writes and queries. ESLint recommended/Node rules passed for both new JS files and repository Prettier settings were applied.

Coverage: saved values and retrieval, server ownership/IDs, forged fields, separation of two same-owner targets, both child query filters, foreign/missing products before child access, missing identity, malformed product identifiers, invalid review input without partial writes, empty input/results, oversized batches and commit failure.

Run in the actual apps/backend branch:

```powershell
npm test -- --runInBand
npm run lint
npx prettier --check src/services/reviewService.js tests/services/reviewService.test.js
```

The previously reported 36 tests plus these 20 should total 56 if the branch has not gained other tests. Confirm the actual terminal result. No live Firebase verification, CI run, HTTP integration or production database write was performed for this package. The prior live Canopy import verified #20/#21 only and did not persist its reviews.
