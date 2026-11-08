# S1-020: Canopy review extraction

## Implemented scope

`apps/backend/src/services/canopyService.js` retrieves US Amazon top reviews using Canopy's REST API. It identifies individual review records and maps body/rating to text/rating for the S1-021 normalizer. The selected approach is an external API, not scraping or hard-coded fallback reviews.

Official sources checked November 8, 2026:
- https://www.canopyapi.co/amazon-reviews-api
- https://docs.canopyapi.co/

Endpoint: GET https://rest.canopyapi.co/api/amazon/product/top-reviews
Query: asin extracted from an HTTPS amazon.com product URL, domain=US.
Headers: API-KEY and AMAZON_COOKIE. Current Canopy documentation requires a signed-in Amazon session cookie for US reviews. Treat both as server secrets. Do not commit them, send them from frontend, or include them in logs.

This endpoint returns representative top reviews, not every product review. Pagination and other Amazon domains are outside this implementation. Empty upstream collections remain empty; downstream must not claim a successful populated import based only on HTTP success.

## Configuration

The service reads CANOPY_API_KEY and CANOPY_AMAZON_COOKIE from process.env at call time. The backend bootstrap must load its server environment before invoking it; this service does not load .env itself. Match existing team configuration or explicitly inject the apiKey/amazonCookie options. Do not overwrite the team's .env.example: add empty placeholders only if missing.

CANOPY_API_KEY=
CANOPY_AMAZON_COOKIE=

Never ask users to paste session cookies into the application. A teammate administering the server must provision the provider credentials through the team's private channel.

## Integration contract

Exports:
- parseAmazonSource(sourceUrl): validates supported URL and returns { asin, domain }.
- mapCanopyReviews(payload): independently testable provider response mapping.
- fetchCanopyReviews(sourceUrl, options?): retrieves and maps reviews asynchronously.

Documented response path: data.amazonProduct.topReviews.
Mapping: body -> text, rating -> rating, id -> sourceReviewId, title -> title,
reviewer.name -> reviewerName, verifiedPurchase -> isVerifiedPurchase.
No source-supplied ownership fields are forwarded. Malformed individual records are retained as null for #21 to reject; a malformed collection throws instead of pretending to be empty success.

Intended controller/orchestrator usage AFTER authentication and target ownership verification:

```js
import { fetchCanopyReviews } from './services/canopyService.js';
import { normalizeReviews } from './services/reviewNormalizer.js';

const mappedReviews = await fetchCanopyReviews(ownedProduct.amazonUrl);
const { reviews, rejected } = normalizeReviews(mappedReviews);
```

Adjust relative imports to caller location. This is a contract example, not a new route. Vincent's controller should resolve the owned target/product according to the team's accepted schema. Persist accepted reviews through #22 and record final state through #23. Do not trust a client userId or mark success before persistence completes.

Errors expose code, status, and a sanitized message. They do not expose provider bodies, URLs with secrets, or underlying network errors. Current errors are plain Error instances carrying those properties; align with the team's AppError/error middleware when wiring routes. HTTP-facing status defaults to 502 for provider failures, 503 for missing configuration, and 400 for unsupported URLs. Provider 429 has code PROVIDER_RATE_LIMITED. There are no automatic retries; one invocation uses at most one provider request, with a 15-second timeout including body decoding. Redirects are disallowed.

## Validation and remaining work

11 Jest tests passed in the assistant environment with Node's experimental VM module flag. ESLint recommended rules, Node globals and no-console warning passed on both new files. Prettier applied using the repository's formatting configuration. A separate offline compatibility check passed against the existing #21 normalizer. These are local checks, not GitHub CI results or a live Canopy validation.

Tests cover URL parsing, invalid source rejection before requests, documented field mapping, malformed records/collections, empty results, request destination/credentials, missing credentials, HTTP errors, network/JSON errors and timeouts. Fixtures are synthetic examples of the documented shape, not captured real reviews.

From apps/backend after copying files:

```powershell
npm test -- --runInBand
npm run lint
npx prettier --check src/services/canopyService.js tests/services/canopyService.test.js
```

Remaining before claiming complete end-to-end ingestion: verify one authorized live import with privately configured credentials, connect to #21 and approved routes/ownership checks, persistence #22 and result state #23. No live requests were made during development. Re-run the team's full suite/CI after installing these files.
