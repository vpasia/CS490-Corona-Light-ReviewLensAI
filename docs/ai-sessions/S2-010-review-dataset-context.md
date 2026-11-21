# S2-010: Review Dataset Context for Q&A AI Session

- **Tool:** OpenAI Codex with Compound Engineering `ce-brainstorm` and `ce-plan`
- **Date:** 2026-11-17
- **Ticket:** [S2-010 / issue #53](https://github.com/vpasia/CS490-Corona-Light-ReviewLensAI/issues/53)
- **Branch:** `feature/S2-010-review-dataset-context`

## Relevant prompts and response summaries

1. **Prompt:** “While we wait for approvals for PR, lets switch to main, pull latest changes and then begin brainstorming for S2-010, $compound-engineering:ce-brainstorm.”
   **Response summary:** Codex switched to `main`, fast-forwarded from `origin/main`, read S2-010 and neighboring ticket scopes, and found that S2-008 had already merged. It grounded the discussion in the existing owned active-dataset read and the absent Q&A route.
2. **Prompt:** “Give me potential tradeoffs between the 6 potential approaches.”
   **Response summary:** Codex compared full-dataset context, relevance selection, RAG, embeddings and vector search, search/filtering, and batch processing. It explained that RAG is a workflow and embeddings or search are possible retrieval methods. It recommended full saved context when measured input fits.
3. **Prompt:** “I think all saved reviews when they fit a measured token budget. I love the bounded fallback. I think we can build the first version to handle oversized datasets with a fallback … Outscraper … capped at 12 reviews per fetch.”
   **Response summary:** Codex checked Outscraper's official Amazon reviews documentation, which states a maximum of 12 reviews per query, and the open [S2-PRE-001 / issue #64](https://github.com/vpasia/CS490-Corona-Light-ReviewLensAI/issues/64) prerequisite. It kept provider suitability separate from S2-010's use of persisted reviews.
4. **Prompt:** “Yes before we build the plan can you briefly explain the S2-008 discussion we had regarding separate review snapshots again.”
   **Response summary:** Codex restated the team decision: public source reviews are shared by ASIN for 14 days after an owned-target check; each user's questions and answers remain private. The developer then requested a feature branch and a ce-plan implementation plan with this AI session record.
5. **Prompt:** “Lets switch to new branch called feature/ (named appropriately) also keep track of prompts/plans for our ai session for this ticket including brainstorming, and lets implement a plan $compound-engineering:ce-plan.”
   **Response summary:** Codex created `feature/S2-010-review-dataset-context`, read the ticket and required repository standards, researched existing service and test seams plus official Gemini token counting, and wrote the local implementation plan. This turn changed no production code.
6. **Prompt:** “$compound-engineering:ce-doc-review.”
   **Response summary:** Codex reviewed the S2-010 plan with coherence, feasibility, scope, security, and adversarial lenses. All five returned no material findings, so the plan needed no edits. The optional cross-model review stopped before sending document content because its transport package could not be resolved.

## Plan retained for implementation

The local CE plan is `docs/plans/2026-11-17-2218-feat-s2-010-review-dataset-context-plan.md`. This clone ignores `docs/plans/` through `.git/info/exclude`, so the plan is local and this record preserves its main decisions for team review:

- **U1:** Add a backend token-counting boundary using the selected Gemini analysis model and the existing backend key. Use mocked provider responses in tests; add no dependency or environment variable.
- **U2:** Build context from `getReviewDataset` for the selected owned product, preserving missing, expired, invalid, and incomplete dataset states and keeping review text as data.
- **U3:** Pack all saved review text into one measured group when it fits, otherwise into ordered measured batches. Preserve full text even when one review needs labeled parts; never silently drop or duplicate evidence.
- **U4:** Document the internal batch contract and context limitations for S2-011. S2-011 owns model generation calls, cross-batch synthesis, and user-facing answer wording.

The application review-token allowance remains a caller-supplied value until S2-011 fixes the complete prompt and output reservation. The Gemini model's published context limit is a ceiling, not an application spending or latency target.

## Kept, changed, and deferred

- **Kept:** The shared 14-day ASIN cache and per-target ownership gate; all active persisted reviews as Q&A evidence; a measured token allowance; complete coverage through bounded batches.
- **Changed:** Replaced the suggested question-relevant subset and routine “dataset too large” message with complete batching after the developer challenged that behavior.
- **Deferred:** Q&A UI, model answer calls, cross-batch answer synthesis, relevance search, embeddings, and Outscraper suitability work tracked in S2-PRE-001.

## Sources and current state

Codex read `docs/ENGINEERING_STANDARDS.md`, `docs/DATA_AND_SECURITY_GUARDRAILS.md`, `docs/UI_UX_STANDARDS.md`, `docs/AI_ASSISTED_DEVELOPMENT_AND_REVIEW.md`, and `docs/CI_TEST_COVERAGE_POLICY.md`, plus the S2-010 ticket and relevant backend services and tests. External claims were checked against [Gemini token documentation](https://ai.google.dev/gemini-api/docs/tokens), [Gemini model information](https://ai.google.dev/gemini-api/docs/latest-model), and [Outscraper's Amazon reviews API reference](https://docs.outscraper.com/endpoints/amazon-reviews/).

## Implementation continuation

**Prompt:** “Are we able to implement now?”

Codex treated this as authorization to implement the reviewed plan on the existing feature branch. It re-read the S2-010 issue and repository rules, checked the official [Gemini token-counting documentation](https://ai.google.dev/gemini-api/docs/tokens), and used the `ce-work` workflow. Tests were written before the two backend services; each focused suite first failed because its production module was absent, then passed after implementation.

`buildReviewContext(uid, productId, { db, tokenLimit, countTokens })` is an internal service interface for the future Q&A orchestration. The caller must pass the verified UID, selected product ID, and a positive **review-evidence** token allowance after reserving room for its instructions, question, and output. The service calls the owned active saved-dataset read once, then returns `{ productId, sourceReviewCount, batches }`. Each ordered batch has `{ index, text, tokenCount, reviewIds }`; `text` is JSON review evidence for a user/data part of the future model request, never a system instruction. It contains only saved review ID, rating, and full text. Split reviews include `partIndex` and keep the same review ID. The service fails rather than return partial coverage. S2-011 must use every batch and synthesize across them before claiming an answer about the full saved dataset.

The Gemini boundary counts the exact serialized batch text using `gemini-3.8-flash:countTokens` and the existing backend-only `GEMINI_API_KEY`. To run this boundary against Gemini, the developer must set `GEMINI_API_KEY` in the ignored `apps/backend/.env` file; `apps/backend/.env.example` already lists the variable. It does not generate an answer. Missing credentials, provider failures, and malformed counts produce safe errors; tests use fake responses and no real provider or user data. The test counter is injected only for offline verification.

No dependency or environment variable was added. Codex did not commit, push, merge, or open a PR. The existing unrelated untracked `apps/frontend/.env.example` was left untouched. This record contains no credentials or real user data.

## Verification and clarification

**Prompt:** “What do you mean new service file exceed the changed-line target?”

Codex clarified that the Jest coverage report measured 100% lines for `geminiTokenCounter.js` and 96.49% lines for `reviewContextService.js`, above the policy's 80% changed-line threshold. The separate `diff-cover` command was not run, so those file percentages should not be described as a formal changed-line check. The new files remain untracked because a request to mark them intent-to-add for automated code review was interrupted; no index change occurred.

Backend verification: `npm.cmd run lint` passed; `npm.cmd run test:coverage` passed with 187 tests and 93.23% overall line coverage; Prettier check passed for the new JavaScript files and this record. A live Gemini call was not made. The S2-011 caller still needs to choose the numeric review-evidence allowance and reserve tokens for its final prompt and answer.

**Prompt:** “You forgot one thing to mention I need to add the gemini api key.”

Codex confirmed that `GEMINI_API_KEY` is already declared in `apps/backend/.env.example` and read by the new token counter. The developer must provide their own key in `apps/backend/.env` for live Gemini token counting. The key is never added to the AI session record or frontend environment.
