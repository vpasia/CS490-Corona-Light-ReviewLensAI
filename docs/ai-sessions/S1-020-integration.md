> **Shared-ASIN revision:** The schema, persistence and cache behavior below are historical. Use [S1-019-023-shared-asin.md](../S1-019-023-shared-asin.md) for the updated #36 contract. The previous live test validated the earlier implementation; the ASIN revision still needs its own live smoke test.

# S1-020: Canopy Review Extraction

## Implemented scope

`apps/backend/src/services/canopyService.js` retrieves US Amazon reviews using Canopy's paginated REST reviews endpoint. It identifies individual review records and maps them into the input format expected by the S1-021 normalizer.

The selected ingestion approach is an external API. The service does not substitute hard-coded sample reviews when retrieval fails.

Official references:
- https://www.canopyapi.co/amazon-reviews-api
- https://docs.canopyapi.co/
- https://rest.canopyapi.co/api/v1/openapi.json (OpenAPI spec; source of the response shape below)

Endpoint:
GET https://rest.canopyapi.co/api/amazon/product/reviews

Query parameters:
- asin: extracted from a supported HTTPS Amazon.com product URL.
- domain: US.
- page: 1, 2, 3, … (one request per page).

No filters are sent (`rating`, `onlyVerifiedReviews` and `search` are omitted).

Request headers:
- API-KEY
- AMAZON_COOKIE

Canopy's documentation requires a signed-in Amazon.com session cookie on every page of paginated reviews. Both credentials must remain on the backend and must never be committed, logged, or sent from the frontend.

Pagination: the service requests pages in order and stops when any of these is true:

- at least 15 usable reviews have been collected (usable = passes the S1-021 normalizer and is not a duplicate);
- `pageInfo.hasNextPage` is not `true` (the product has no more reviews; whatever exists is returned);
- a page returns zero reviews;
- 10 pages have been requested.

All pages share one 120-second deadline. Each request uses the smaller of the time left and the 60-second per-request limit. If any page request fails (network error, timeout, non-2xx status, unreadable JSON, provider errors, or a malformed collection), the whole call fails and no reviews are returned, so the import saves nothing. Requests are not retried and there is no fallback to the top-reviews endpoint.

Review batches cached from the earlier top-reviews implementation are reused until they expire (14 days). Other Amazon marketplaces remain outside this implementation.

An empty provider collection remains empty. An HTTP success alone does not establish that a populated import succeeded.

## Configuration

The service reads these environment variables at call time:

```dotenv
CANOPY_API_KEY=
CANOPY_AMAZON_COOKIE=
```

For local development, configure them privately in `apps/backend/.env`. The backend bootstrap or manual command must load that file before calling the service. The service does not load `.env` itself.

Options also allow credentials to be supplied explicitly for testing.

Only empty placeholders belong in `.env.example`. Never commit actual credentials.

An Amazon session cookie represents a signed-in session. Provision it privately on the backend; application users should not be asked to submit cookies through the UI.

## Service contract

Exports:

- `parseAmazonSource(sourceUrl)`: validates a supported URL and returns `{ asin, domain }`.
- `mapCanopyReviews(payload)`: maps provider-specific fields independently of network access.
- `fetchCanopyReviews(sourceUrl, options?)`: retrieves and maps reviews asynchronously.

The expected provider response collection is:

```text
data.amazonProduct.reviewsPaginated.reviews
```

Page information is read from `data.amazonProduct.reviewsPaginated.pageInfo.hasNextPage`. Missing or malformed page information is treated as the last page.

Field mapping:

| Canopy field | Normalizer input field |
| --- | --- |
| body | text |
| rating | rating |
| id | sourceReviewId |
| title | title |
| reviewer.name | reviewerName |
| verifiedPurchase | isVerifiedPurchase |

The adapter does not forward source-supplied ownership fields.

Malformed individual records are represented as `null` so the normalizer can reject them. Missing or malformed review collections cause an error instead of being treated as an empty successful response.

## Connection to S1-021

After authentication and target ownership verification, an orchestration service can retrieve and normalize reviews:

```js
import { fetchCanopyReviews } from './services/canopyService.js';
import { normalizeReviews } from './services/reviewNormalizer.js';

const mappedReviews = await fetchCanopyReviews(ownedProduct.amazonUrl);
const { reviews, rejected } = normalizeReviews(mappedReviews);
```

Adjust relative import paths for the calling file.

This example demonstrates service composition. The authenticated application route and controller are separate integration work.

The normalizer returns an internal `{ reviews, rejected }` result. That internal object is not the public API response contract.

The stored-review list endpoint must follow the engineering standards:

```json
{
  "data": [],
  "nextCursor": null,
  "count": 0
}
```

The final import endpoint response must be agreed with the controller implementation.

Accepted reviews must be persisted through S1-022. Final ingestion results must be recorded and reported through S1-023.

User identity must come from verified authentication. A client-supplied userId must never establish ownership.

## Timeouts and errors

The default timeout is 60 seconds, including response body decoding. Tests and callers can override it with `timeoutMs`, which accepts integer values from 1 through 60000 milliseconds.

There are no automatic retries. Each invocation makes at most one provider request. Redirects are disallowed.

Errors expose a code, status, and sanitized message. They do not expose credentials, provider response bodies, or underlying network error details.

Current error codes include:

- INVALID_AMAZON_URL
- INGESTION_NOT_CONFIGURED
- PROVIDER_TIMEOUT
- PROVIDER_UNAVAILABLE
- PROVIDER_RATE_LIMITED
- PROVIDER_AUTH_FAILED
- UPSTREAM_PROVIDER_ERROR
- INVALID_PROVIDER_RESPONSE

Status defaults:
- 400 for unsupported Amazon URLs.
- 503 for missing provider configuration.
- 502 for provider failures.

The current implementation uses plain Error instances with code and status properties. Before application integration, align these with the team's AppError class and standard error middleware.

## Automated validation

After updating the branch with the team's product services and authentication middleware, the following checks passed locally:

```powershell
npm test -- --runInBand
npm run lint
```

Results:
- 4 test suites passed.
- 36 tests passed.
- Backend lint passed.

The 36 tests comprise:
- 11 Canopy service tests.
- 10 review normalization tests.
- 15 existing product service and authentication middleware tests.

Canopy tests use deterministic mocks and synthetic fixtures based on the documented provider response shape. Automated tests make no live Canopy requests.

Coverage includes:
- Supported and unsupported source URLs.
- Field mapping.
- Malformed records and collections.
- Empty review collections.
- Provider destination and credential headers.
- Missing credentials.
- HTTP errors.
- Network failures.
- Invalid JSON.
- Request timeouts.

The Canopy files were previously formatted using the repository's Prettier configuration.

These are local validation results. They do not establish the current GitHub CI status.

## Live verification — November 8, 2026

Manually tested real Canopy retrieval followed by S1-021 normalization for:

```text
https://www.amazon.com/dp/B07PRVS98X
```

The first attempt exceeded the original 15-second timeout.

A subsequent request with a 60-second timeout completed with:

| Result | Count |
| --- | --- |
| Received | 13 |
| Accepted | 13 |
| Rejected | 0 |

The service's default timeout was then changed to 60 seconds. All 36 backend tests and backend lint passed after that change.

The successful manual command loaded credentials from the local `.env`, called `fetchCanopyReviews`, and passed its returned records to `normalizeReviews`.

Only counts and a completion message were displayed. Credentials and full review text were not printed.

This verifies real retrieval and normalization for one product. It does not verify Firestore persistence, authenticated HTTP routes, frontend integration, or final ingestion status reporting.

## Remaining work

- Align service errors with the team's AppError and error-handling conventions.
- Implement review persistence with ownership checks through S1-022.
- Implement ingestion coordination and result tracking through S1-019 and S1-023.
- Connect services to authenticated controllers and routes.
- Verify cross-user isolation before provider calls and database writes.
- Verify the completed application flow and GitHub CI before merging.
