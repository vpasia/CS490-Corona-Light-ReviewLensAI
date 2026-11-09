# S1-016 AI-assisted development record

- Tool: OpenAI Codex
- Date: 2026-11-08
- Ticket: S1-016, validate AnalysisTarget input
- Branch: `feature/S1-016-validate-analysis-target-input`

## Relevant prompt and response

> Developer prompt excerpt: "Implement the plan in a fresh context ... Reject invalid product names and Amazon product URLs at the backend before `POST /api/products` writes a product."

> Developer follow-up: "S1-011 is now merged, continue with executing plan."

> Codex response summary: Confirmed that merged `main` contains S1-011, then created an isolated S1-016 branch. Added Supertest cases before implementation, observed failures for malformed source input and long names, and added one validation middleware to the product creation route.

## What was kept, changed, or rejected

- Kept: S1-011's controller, service, verified-token ownership, and `201 { data: { productId } }` response. The service's required-field checks remain.
- Changed: The middleware trims the name and URL, checks a 200-character name limit and S1-015-compatible Amazon product links, and sends one `400 VALIDATION_ERROR` detail per invalid field. Tests cover rejected inputs with no write, accepted regional links, trimming, and forged `userId` ownership.
- Rejected: Accepting a bare ASIN directly in `amazonUrl`; S1-015 converts one to a product URL before calling the API. No dependency, Amazon request, ASIN field, or frontend change was added.

## Verification and review

- Supertest uses fake tokens and in-memory Firestore behavior. No production credentials or real user data were used.
- Backend tests, ESLint, and Prettier checks were run locally. A fresh review of the current checkout found that Node's URL parser removes embedded tabs and newlines while the original URL would be saved. A route test reproduced the issue; the middleware now rejects those characters before parsing.
- Input validation and user-facing errors require a second human reviewer and the security checklist under AI-33 before merge. The author should also manually try the feature in a locally running app under AI-23.
