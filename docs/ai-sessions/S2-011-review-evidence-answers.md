# S2-011: Review Evidence Answers AI Session

- **Tool:** OpenAI Codex with Compound Engineering `ce-brainstorm`, `ce-plan`, and `ce-doc-review`
- **Date:** November 19, 2026
- **Ticket:** S2-011, “Answer Questions from Review Evidence,” in `Sprint2Issues.csv`
- **Plan:** Local ignored `docs/plans/2026-11-19-2149-feat-s2-011-review-evidence-answers-plan.md`

## Brainstorm prompts and responses

1. **Developer prompt:** “Lets begin planning only for S2-011, keep in mind S2-010 is not merged into main yet, $compound-engineering:ce-brainstorm so lets read the scope, understand the scope of ticket, technical requirements and brainstorm.”
   **Response summary:** Codex read S2-011 and adjacent tickets, project standards, the S2-010 context service, and current backend routes. It found that S2-011 needs the backend answer path and cross-batch synthesis; it asked what would make answers useful and trustworthy.
2. **Developer prompt:** Answers should name recurring issues, explain experiences, point to representative reviews, state theme and dataset counts, distinguish repeated from frequent, and avoid presenting AI estimates as exact counts.
   **Response summary:** Codex identified saved review IDs as available references and noted that the current Canopy mapping does not provide source review URLs. It asked how to describe two mentions among 15 reviews.
3. **Developer prompt:** Two of 15 is a repeated but limited observation, not frequent. “Frequent” needs a substantial share and enough independent reviews, with the count visible.
   **Response summary:** Codex compared a freeform answer with checked references, a per-review evidence tally, and a reusable theme summary. It recommended the per-review tally because counts could be traced to distinct saved reviews.
4. **Developer prompt:** “I like 2) review by review evidence tally.”
   **Response summary:** Codex carried that choice forward and asked for a concrete frequency cutoff.
5. **Developer prompt:** “I say at least 4 distinct reviews and 20% of dataset.”
   **Response summary:** Codex recorded both conditions as the frequency rule and asked how to answer when no theme meets it.
6. **Developer prompt:** “Yes, show the observed themes with that caveat.”
   **Response summary:** Codex synthesized a scope with evidence counts, representative references, the frequency rule, and complete coverage of S2-010 context batches.
7. **Developer prompt:** “Confirmed, write the requirements-only plan make sure it knows to read necessary docs/ to pull all latest changes from main, branch out to a new feature/ (branch named approprieatly), and make sure ai-sessions gets everything since brainstorming.”
    **Response summary:** Codex wrote the requirements-only plan with implementation handoff instructions and created this sanitized session record. No implementation, branch switch, pull, commit, push, or PR was performed in this planning turn.

## Decisions retained in the plan

- Use Gemini 3.8 Flash for S2-011's in-scope analysis. Leave a separate Gemini 3.5 Flash-Lite relevance check outside this ticket.
- Analyze the complete active saved dataset. Account for every S2-010 batch before making whole-dataset claims.
- Tally distinct saved review IDs supporting each reported theme. Give counts, total dataset size, and short verified excerpts from representative saved reviews.
- Use “frequent” only with at least four distinct supporting reviews and at least 20% of the active saved dataset. If none qualifies, report observed themes and say none qualifies.
- Treat review text as untrusted data. Do not fabricate claims, counts, or references.

## Evidence and limits

- [S2-010 PR #70](https://github.com/vpasia/CS490-Corona-Light-ReviewLensAI/pull/70) and [S2-009 PR #69](https://github.com/vpasia/CS490-Corona-Light-ReviewLensAI/pull/69) were verified merged during this session. This clone's local `main` had not yet been updated.
- The current Canopy adapter maps review text, rating, source review ID, title, reviewer name, and verified-purchase status, but not a review URL. Internal saved review IDs are available.
- Google guidance on [AI security](https://docs.cloud.google.com/architecture/framework/perspectives/ai-ml/security) supports treating review content as untrusted and using layered safeguards. A second question-classification model alone is not a prompt-injection guarantee.
- The plan was enriched in place into an implementation plan in this clone's ignored `docs/plans/` directory. It has no production implementation or live Gemini answer test.

## Implementation planning prompts and responses

1. **Developer prompt:** “Looks good to me” followed by `$compound-engineering:ce-plan`.
   **Response summary:** Codex used the confirmed requirements-only plan as the Product Contract, checked the merged S2-009 frontend contract and S2-010 context service, researched the official Gemini generation and structured-output contracts, and prepared backend implementation and verification units. No code, branch, or git remote was changed.
2. **Developer clarification:** Clickable saved-review links can be deferred. Short review excerpts in the answer are acceptable for now, with link behavior considered in the PR description or later work.
   **Response summary:** Codex clarified R6 and AE2 to require short excerpts verified against the saved reviews. Internal review IDs remain for evidence validation and deduplication; the current plain-text Q&A panel remains the interface.
3. **Planning scope confirmation:** The plan covers the complete S2-011 backend answer path and tests. An incomplete or invalid Gemini batch result stops the answer instead of producing a partial whole-dataset claim.
   **Response summary:** Codex enriched the existing plan with technical decisions, three implementation units, test scenarios, verification commands, and done criteria. The plan keeps one ownership-checked saved dataset read for both context and excerpt verification.

## Planning review and limits

- The document review checked coherence, feasibility, scope, security, and adversarial concerns. It corrected cleanup wording so pre-existing working-tree changes remain untouched. It also clarified that one authorized context-builder read supplies both batches and the source reviews used to verify excerpts.
- A reviewer raised possible Gemini quota or cost abuse from repeated authenticated questions. The plan does not add a rate limiter without an established product limit, repository pattern, or usage budget; provider failures remain safe. The team can decide a separate quota policy if usage warrants one.
- Official references used for planning: [Gemini generateContent](https://ai.google.dev/api/generate-content), [structured output](https://ai.google.dev/gemini-api/docs/structured-output), and [token counting](https://ai.google.dev/gemini-api/docs/tokens). The live structured-response contract still needs a fake-data smoke check during implementation.
- No production code, tests, branch switch, pull, commit, push, or PR was performed during planning.

## Implementation prompt and response

1. **Developer prompt:** “start implementation.”
   **Response summary:** Codex fast-forwarded local `main` to the merged remote branch and created `feature/S2-011-review-evidence-answers`. It reread the S2-011 ticket, standards, plan, merged S2-009 interface, S2-010 context service, and current official Gemini API documentation. It added the backend analysis route, question validator, Gemini structured-output adapter, evidence accounting service, and tests. The existing frontend receives the plain `data.answer` string; no frontend code was changed.

## Implementation decisions and review

- `buildReviewContext` now returns the same normalized source reviews it used for context batches to its service caller. This lets answer verification use one ownership-checked active dataset read; those reviews are not returned by the API.
- The backend measures instruction and question overhead before choosing an evidence allowance, then processes every context batch. A model result must cover each review or split part. The backend verifies saved IDs and exact excerpts, groups matching theme names, counts distinct reviews, and applies the four-review and 20% frequency rule.
- The output uses short verified excerpts in the existing plain-text answer view. Clickable links remain deferred. Gemini still interprets themes, so classification quality needs human evaluation with fake data; exact excerpts and deterministic counts make its claims inspectable.
- An added regression test showed that a model-supplied theme containing a newline could make a false count appear as a separate line. The service now rejects control characters in theme names and excerpts.
- Review of the new adapter removed an unused freeform experience field. The answer uses the theme name and literal excerpt to convey what customers reported.

## Implementation verification

- Focused tests were written before each new implementation seam and failed on the missing behavior. After implementation, the backend suite passed with 203 tests across 16 suites and overall coverage above the repository's thresholds. Backend ESLint and Prettier checks for new files passed; `git diff --check` passed before final review.
- The repository-wide backend Prettier check reports existing formatting issues across many untouched files. Those files were left unchanged.
- A live Gemini generation smoke check was not run: `GEMINI_API_KEY` was not available in this shell. Automated tests use fake keys and mocked provider responses. No key or real review text was logged or stored in this transcript.
- No dependency or environment-variable configuration was changed. No commit, push, merge, or PR was performed by Codex. Prompt construction, Gemini integration, and input validation require two human reviewers before merge.

## Follow-up review findings and verification

- A correctness review found that batch-level theme labels could diverge and split counts, and that an exact excerpt alone did not prove a model-supplied theme. The analyzer now receives previously established theme names, must reuse them for the same experience, and new labels must appear as phrases in their exact excerpts. The service validates the excerpt against the saved review and permits an established theme name on later reviews, while still deriving counts from distinct saved review IDs.
- Frequency wording now recognizes common-drawback phrasing. Gemini findings distinguish `complaint` from `other`, and only complaint themes can be labeled frequent. The provider output reserve is 2,048 tokens and matches Gemini's `maxOutputTokens`; the complete instruction, question, existing theme names, and batch evidence are measured before each generation request.
- Added regression coverage for unsupported labels, theme continuity across batches, common-drawback caveats, positive themes not being called complaints, and complete prompt input budget enforcement.
- Review limitation: the mock prompt-injection test confirms ReviewLens treats the provider output as data and formats its result; it does not demonstrate that Gemini itself resists prompt injection. Live Gemini behavior remains unverified because no API key was available in the implementation shell.
- Final verification after the follow-up changes: all 208 backend tests pass across 16 suites and ESLint passes. Prettier checks pass for the new files; four modified existing files (`productController.js`, `productRoutes.js`, `reviewContextService.js`, and its test) already fail Prettier on the branch base, confirmed by checking their `HEAD` versions. They were not reformatted beyond the scoped S2-011 edits. `git diff --check` passes. The dedicated code-review attempt did not produce a completed receipt because reviewers hit model usage limits; a local manual diff scan found no remaining blocking issues. No commit, push, merge, or PR was performed.

## Pre-PR code review and targeted fix

- **Developer prompt:** Requested a Compound Engineering code review before raising a PR, with commit groups and a PR description if the change was ready.
- **Review response:** Eight local review lenses identified two validated findings in `qaService.js`. Finding #1 was a P1: the first batch rejected a shared theme label when only a later review's excerpt contained that label. Finding #2 was a P2: frequency questions using words such as "recurring" could miss the caveat. The cross-model Claude review job could not be retrieved, so its coverage was unavailable. No commit or PR was made.
- **Developer prompt:** "Lets fix #1 issue".
- **Implementation response:** `checkBatch` now validates each output entry and exact saved-review excerpt, collects theme labels anchored by any excerpt in the batch, then checks that every finding uses an anchored or previously established label. A regression test puts the unanchored instance before the anchoring instance in the same first batch. Finding #2 remains open.
- **Verification:** All 209 backend tests passed across 16 suites; backend ESLint, targeted Prettier check, and `git diff --check` passed. The focused Jest suite passed 15 tests but did not meet global coverage thresholds when run alone; the full suite met them. No live Gemini smoke check was run.

## Frequency wording follow-up

- **Developer prompt:** "Fix issue #2" from the pre-PR code review.
- **Implementation response:** Complaint questions no longer depend on a short frequency keyword list. The answer labels qualifying complaint themes as frequent and adds the no-frequent caveat when a complaint question or observed complaint has no qualifying theme. A non-complaint question with only positive themes does not receive that caveat. Two regression cases cover "recurring complaints" with two and four of 15 saved reviews.
- **Verification:** All 211 backend tests passed across 16 suites; backend ESLint and `git diff --check` passed. The test file was formatted with Prettier. No live Gemini smoke check was run. Both findings from the pre-PR code review are now addressed locally; no commit, push, merge, or PR was made.
