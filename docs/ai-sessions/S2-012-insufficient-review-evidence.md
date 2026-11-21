# S2-012: Insufficient Review Evidence AI Session

- **Tool:** OpenAI Codex with Superpowers brainstorming, writing-plans, and executing-plans skills
- **Date:** November 20, 2026
- **Ticket:** S2-012, “Handle Questions with Insufficient Review Evidence,” from `Sprint2Issues.csv`
- **Local design:** `docs/superpowers/specs/2026-11-20-s2-012-insufficient-review-evidence-design.md` (ignored in this clone)
- **Local plan:** `docs/superpowers/plans/2026-11-20-s2-012-insufficient-review-evidence.md` (ignored in this clone)

This record covers the conversation from the first S2-012 brainstorming request onward. Repeated pasted skill instructions, tool outputs, and routine progress notifications are condensed; every substantive developer prompt, decision, interruption, and resulting code decision is included. No secrets or real user reviews are included.

## Branch setup and ticket reading

1. **Developer:** “Ticket S2-011 is now merged into main, so lets checkout to main, pull any new code from main, and lets checkout to feature/ branch named approprieatly for ticket S2-012 then begin brainstorming for scope of S2-012, then read the scope of S2-012 - Handle questions with Insufficient Review Evidence  $superpowers:brainstorming” The developer supplied local `AGENTS.md` instructions and the full brainstorming skill text.
   **Codex:** Read the ticket source and current branch state. A local S2-011 session-record edit blocked switching branches, so Codex saved that edit in a named stash, switched to `main`, fast-forwarded from `origin/main` to `4d3fce3`, and created `feature/S2-012-insufficient-review-evidence`. No product code was changed during this setup.
2. **Developer:** “Begin reading the scopr and technical guidance for S2-012 $superpowers:brainstorming” The developer supplied the brainstorming skill text again.
   **Codex:** Read S2-011, S2-012, and S2-013 from `Sprint2Issues.csv`, the merged Q&A service and Gemini analyzer, the scope evaluation fixture, and relevant engineering/UI standards. S2-012 asks ReviewLens to state when a relevant question is unsupported by the active saved reviews. Its example asks about nighttime parking safety when reviews only discuss food and service. The ticket calls for a prompt distinction between supported and absent information and a controlled absence-of-evidence test. Codex noted that the current analyzer already says not to infer absent facts, but its no-match answer does not explain the specific limitation. Codex asked how to handle partial evidence.

## Brainstorming conversation

3. **Developer:** “Yes. ReviewLens should briefly report the relevant evidence it found, then state the specific conclusion those reviews cannot support. For example: ‘Two reviews mention that the parking lot is well lit, but none describes safety at night, so the reviews do not establish whether it is safe.’”
   **Codex:** Played back the distinction between directly relevant reports, related observations, and unsupported conclusions. Asked whether a few direct reports should be described without becoming an overall yes-or-no answer.
4. **Developer:** “Yes. ReviewLens should say what those reviewers directly reported, show how many of the saved reviews address the question, and state that this limited evidence cannot support an overall yes-or-no conclusion. For example: ‘Two of 15 reviewers described feeling safe in the parking lot at night. The other reviews do not address nighttime safety, so these reports do not establish whether the parking lot is generally safe.’”
   **Codex:** Confirmed that the answer needs both a direct-review count and the total saved dataset. Noted that S2-011’s four-review/20% threshold only labels frequent complaints. Asked how to decide that evidence is enough for a broader answer.
5. **Developer:** “ReviewLens should decide based on what the question asks, not borrow the ‘frequent complaint’ threshold. For a question about reviewer opinion, count the distinct reviews that directly address it, report both that count and the total saved dataset, and show whether those accounts agree or conflict. It can say ‘most of the reviewers who discussed parking felt safe’ when the tally supports that wording. If only a few address it, describe their experiences and say the reviews do not support an overall conclusion. For a claim about the product or real-world safety, reviewer agreement alone does not establish the fact. ReviewLens should keep the answer attributed to reviewers.”
   **Codex:** Separated opinion tallies from product and safety facts. Asked whether “both” was acceptable for two agreeing reports out of 15 when the answer also limits the general conclusion.
6. **Developer:** “Yes, if the complete saved dataset confirms that exactly two reviewers addressed it. ReviewLens can say: ‘Two of 15 saved reviews discuss nighttime parking safety, and both reviewers said they felt safe. Those two reports are too limited to determine whether the parking lot is generally safe at night.’ ‘Both’ accurately describes the two relevant reports; it does not imply agreement across all 15 reviews.”
   **Codex:** Presented two approaches: extend the existing review-by-review structured evidence analysis, or add a final synthesis call after theme extraction. Recommended the first because IDs, excerpts, and counts can be checked against saved reviews.
7. **Developer:** “First approach”
   **Codex:** Accepted review-by-review analysis. Asked whether the sufficiency judgment should use the question, direct-review count, and full dataset rather than a universal numeric cutoff.
8. **Developer:** “Yes”
   **Codex:** Wrote the local design document. A fresh builder check reported “nothing important left.” The design preserves the existing route, plain answer string, ownership boundary, complete-batch accounting, exact-excerpt checks, and the separate S2-013 scope work. Codex attempted to stage the ignored design document because the skill normally calls for a committed design; that command was interrupted.
9. **Developer:** “Approved”
    **Codex:** Used the writing-plans skill and saved a local ignored two-task implementation plan for structured evidence classification and bounded answer rendering. Recommended native execution because both tasks share the Q&A service.
10. **Developer:** “native execution”
    **Codex:** Began inline execution. Confirmed the feature branch and backend dependencies, read the testing skill, and ran a clean baseline: 211 backend tests passed across 16 suites.

## Kept, changed, and deferred

- **Kept:** Existing `/analyze` response shape, verified-UID ownership gate and shared-ASIN cache boundary, complete batch processing, exact saved-review excerpt validation, distinct-review counting, complaint frequency rule, and plain-text frontend display.
- **Changed:** Gemini's review-level structured result now distinguishes direct from related findings and includes a stance for yes-or-no reviewer reports. Backend answers state how many saved reviews directly address a question, separate related observations, and limit broader conclusions.
- **Deferred:** S2-013’s broader scope prompt and classifier, new dependencies or configuration, and a second synthesis model call. The local design and plan remain ignored and untracked at the developer's request. Codex has not pushed, merged, opened a PR, or created a Task 2 commit.

## Verification and review

- Task 1: targeted tests 27/27; full backend suite 214/214; lint, targeted Prettier, and `git diff --check` passed.
- Task 2 before review: targeted tests 36/36; full backend suite 223/223 across 16 suites; lint, targeted Prettier, and `git diff --check` passed.
- The Gemini request shape and JSON Schema fields were checked against the current official [structured-output documentation](https://aistudio.google.com/docs/structured-output) and [generateContent reference](https://aistudio.google.com/api-reference/generate-content). No live Gemini response was verified in this session.
- A fresh whole-change review found five important answer issues: the caveat ignored question type; direct reviews were also counted as related-only; stance split one complaint theme's frequency count; opposing and mixed reports lacked a balance summary; and a shared theme could be falsely attributed by equal counts alone. Codex wrote tests that failed on these cases, corrected the service, and reran them green. The reviewer also found a minor pre-existing fabricated-excerpt test fixture with multiple invalid fields; this remains for a later focused test cleanup.
- Final backend verification after those fixes: 230/230 tests across 16 suites, backend lint, targeted Prettier check, and `git diff --check` passed. The exact provider classification quality and output-token headroom remain unverified without a live Gemini response; incomplete provider output still fails safely.
- Per the developer's instruction, Task 2 code, tests, and this session record remain uncommitted for human review and commit. The prompt and provider-output changes require two human security reviews under AI-31/AI-32 before merge.
