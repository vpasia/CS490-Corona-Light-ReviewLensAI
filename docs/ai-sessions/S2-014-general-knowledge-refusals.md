# S2-014 — General-knowledge refusal evaluation

OpenAI Codex · November 18, 2026 · [Issue #57](https://github.com/vpasia/CS490-Corona-Light-ReviewLensAI/issues/57)

## Shared flow integration — November 21, 2026

Codex connected the scope rules to the merged `/analyze` route. Gemini's structured result now carries `outOfScope`. If every review batch is classified outside scope, the service returns a short redirect with HTTP 200 and `data.outOfScope: true`. An in-scope question with no relevant evidence still follows the S2-012 answer path. The route tests cover both results and reject a provider result that marks a batch out of scope while also returning findings.

The automated tests exercise the real route and adapter with a mocked Gemini response. The separate live synthetic route probe timed out during Gemini 3.8 Flash generation, so the integrated model's live refusal remains unverified. See the [S2-013 shared flow record](S2-013-review-qa-prompt.md#shared-flow-integration--november-21-2026).

## Request and response

**Prompt excerpt:** “For S2-014, add evaluation cases for general-knowledge questions, including paraphrases and at least one review question that should be answered. Use the prompt and review context to drive refusals. Use synthetic reviews and mock the model in automated tests. Distinguish what the mocks verify from anything verified against Gemini.”

**Response excerpt:** “I’ve added the four general-knowledge examples, a paraphrase of each, and a review question with supporting evidence. The mocked cases check what the model receives.”

The ticket asks for a polite redirection when a question is unrelated to the active reviews. That keeps the Ask panel focused on what reviewers can tell the user about the selected product.

## Files changed

- [reviewQaScope.test.js](../../apps/backend/tests/services/reviewQaScope.test.js) defines synthetic reviews, eight refusal cases and one grounded answer case. It checks that the mock receives the scoped system instruction, target labels, exact review evidence and each original question.
- This record describes the evaluation and where to run it against the shared Q&A path once available.

## How it works

The Ask panel sends the question through `useAskQuestion` and `productsApi.js` to `POST /api/products/:productId/analyze`. **Pending in S2-011:** the shared backend route authorizes the target, reads its active saved reviews through S2-010, and uses the S2-013 builder to send the scope rules and review evidence to the shared Gemini adapter. **Pending response wiring:** the shared route returns HTTP 200 with `data.answer` and `data.outOfScope: true` for a scope refusal under ENG-28. The Ask panel reads the answer from `data.answer`. See the [S2-013 integration handoff](S2-013-review-qa-prompt.md#how-it-works).

For “Will I need an umbrella this afternoon?”, the expected response redirects the user to the supplied Amazon reviews for Trail Mug. The matching Jest case checks that the umbrella question reaches the mock together with the scope rule and synthetic reviews. The lid question uses the same prompt and context and expects an answer that attributes the lid staying sealed to a reviewer.

## Verification and decisions

- Kept the prompt-driven approach and the four categories in issue #57. Added a paraphrase for each and one question that the synthetic reviews support. Rejected a keyword filter and a mock that implements its own scope classifier.
- The mock returns canned examples of desired behavior. The assertions verify request construction. Actual refusals, evidence-grounded answers and provider response mapping still need verification after the shared path lands. No Gemini request was made.
- Backend lint initially flagged missing explicit Jest imports. After adding them, `npm.cmd run lint` passed. `npm.cmd run test:coverage` passed all 185 tests across 13 suites with 92.65% overall line coverage and 100% line coverage for the prompt builder. Formal changed-line coverage remains for CI.
