# S1-021: review normalization implementation

Status: independently verified module; not an integrated or completed sprint story.
Base: uploaded main snapshot c158600acb6bb0372902a3f73875bc10ba95a843.

Copy the supplied apps/ and docs/ contents into the repository root. Existing
files are not replaced by this package. No dependencies or configuration changed.

## Contract

The source adapter passes an array of objects with text and rating fields.
This is a new internal contract, NOT a claim about Canopy response field names.
Canopy mapping must be verified from official documentation and a representative
response when implementing S1-020. Align these internal names with the product
and persistence owners before integration.

normalizeReview returns { review, reason }. Invalid records have review: null.
normalizeReviews returns { reviews, rejected }; rejected contains input indices
and stable reason codes, not raw provider data. A non-array collection throws an
internal TypeError; the future service must translate this at the API boundary.

Policy: trim text; accept finite numbers or plain decimal strings from 1 to 5;
reject blank text and invalid ratings. Preserve allowed optional strings and a
boolean verified-purchase flag. Dates are retained as source strings without
inventing a timezone or converting uncertain dates. The adapter must map numeric
source IDs to strings explicitly if its verified schema requires that.
No HTML rendering or sanitization occurs here; render text safely in React.
No input record is mutated. No userId or productId is accepted from source data.
The authenticated service supplies ownership after checking the parent product.

Invalid individual records are skipped with reasons. The ingestion service must
report a distinct partial-success state if it saves a batch with rejected records.
Zero valid records must not be described as a successful review import. No
persistence, provider requests, or ingestion success declarations happen here.

## Test evidence

Verified locally on Windows on November 6, 2026:

- `npm test -- --runInBand`: all 10 Jest tests passed.
- `npm run lint`: passed with no reported errors or warnings.
- Prettier ran successfully on the normalizer and its test file.

The backend test script now enables Node's experimental VM module
support so Jest can run the project's ES module imports.

The input-mutation test originally failed when comparing a
structuredClone snapshot in Jest. It now compares JSON snapshots
of the JSON-only fixture to verify that normalization leaves
the original input unchanged.

GitHub CI and live ingestion integration have not yet been verified.
S1-021 remains pending integration into the ingestion workflow.

## Remaining scope

S1-019: verified authentication and parent ownership, ingestion endpoint/UI.
S1-020: verified Canopy request/response adapter and real source data.
S1-021: connect adapter to this module and confirm canonical fields with the team.
S1-022: Firestore writes/retrieval and ownership tests.
S1-023: durable ingestion attempt state and UI success/failure handling.
All tickets still need integrated tests, CI, and a live application demonstration.

## Walkthrough

1. normalizeReview checks one incoming object.
2. It rejects missing review text rather than inventing text.
3. It validates the rating before conversion can accept misleading values.
4. It copies only supported metadata into a fresh review object.
5. normalizeReviews processes the batch and separates valid and rejected records.
6. The future ingestion service will save the valid list and report the outcome.
