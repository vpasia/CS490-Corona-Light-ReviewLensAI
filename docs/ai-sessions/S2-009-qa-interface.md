\# S2-009 / S2-018 / S2-019 / S2-020 – Review Q\&A Interface



\*\*Tool:\*\* Claude Code (claude.ai/code)

\*\*Dates:\*\* 2026-11-16 to 2026-11-17

\*\*Tickets:\*\* S2-009 (#52), S2-018 (#61), S2-019 (#62), S2-020 (#63)



\## Prompts and responses (trimmed)



1\. \*\*Prompt:\*\* "Can you make the test code for me but walk me through it step by step?"

&#x20;  \*\*Response:\*\* Generated code for productsApi.test and useAskQuestion.test.js.



2\. \*\*Prompt:\*\* "Can you explain the code for me to understand what you did?"

&#x20;  \*\*Response:\*\* Line-by-line explanation of the API call, the hook (useState, useRef, useEffect, useCallback, the request counter, the product-label check), and what each test proves.



\## Kept, changed, or rejected

\- \*\*Kept:\*\* Tests, after reading and understanding every line.

\- \*\*Changed:\*\* endpoint from `/questions` (AI's guess) to the documented `/analyze`.

\- \*\*Fixed during my review:\*\*

&#x20; - `reponse` typo in `askQuestion` (caught by ESLint).

&#x20; - `bode` typo instead of `body` (caught by the new `askQuestion` test).

&#x20; - Curly vs straight apostrophe mismatch in a test string.

\- \*\*Not changed:\*\* no new dependencies, no backend files, no changes to `package-lock.json`.



\## Verification

\- `npm test`: 122 passed. `npm run lint`: passed. Prettier: passed.

\- \*\*AI-22 (tests catch bugs):\*\* replaced the stale-answer check in `useAskQuestion.js` with `if (false)`. 2 tests failed ("ignores a late answer even after switching back to the same product (S2-019)" and "keeps only the newest answer when two questions overlap"). The A→B test still passed because the separate product-label check also protects it. Restored the file and all tests passed.

\- \*\*AI-23 (manual check in the running app):\*\*

&#x20; 1. Product with reviews: panel shows the product name; Ask is disabled when the box is empty.

&#x20; 2. Asking a question shows the error "Endpoint not found." (expected, since `/analyze` is not built yet) and keeps the question in the box.

&#x20; 3. Product with no reviews: question box hidden, "No reviews have been imported…" shown (S2-020).

&#x20; 4. Switching products: panel resets and shows the new product's name (S2-018).



\## Open items

\- Waiting on the backend `/analyze` endpoint (S2-010, S2-011, S2-013) for an end-to-end test. Frontend sends `{ "question": "..." }` and expects `{ "data": { "answer": "..." } }`.

\- Backend halves of S2-018, S2-019, and S2-020 (AI context and empty-target tests) are to be confirmed with the backend owner.

