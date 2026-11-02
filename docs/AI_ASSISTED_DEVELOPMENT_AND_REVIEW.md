**AI-Assisted Development and Review**  
**Ticket: S1-004**  
	This document describes how AI-assisted code is prompted, reviewed, tested, and approved before it is merged.  
**Core Rule**:

- AI-01:  
  - AI generated code is treated as team-authored code. The developer who submits it, **owns it**, **must understand it**, and it follows the same Engineering Standards and Definition of Done as any other code. “The AI wrote it” is never an explanation for a bug, skipped step or any other problem that arises. 

\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

1. **AI Coding Tools we Use**  
   1. 

| Tool | Use |
| ----- | ----- |
| Claude ([claude.ai](http://claude.ai) and Claude Code) | Planning, writing features and tests, explaining code, reviewing diffs |
| GitHub Copilot (optional) | Inline autocomplete in VS Code |

   2. AI-02:  
      1. Only the tools above are used for project code. Adding another tool should be mentioned at stand-up and then added to this table.  
   3. AI-03:  
      1. AI tools are not given write access to GitHub (no pushing merging, or changing repository settings). A human opens every PR.  
2. **Context Supplied to AI Tools**  
   1. Always Provide:  
      1. AI-04: The standards documents in docs/: ENGINEERING\_STANDARDS.md, UI\_UX\_STANDARDS.md, DATA\_SECURITY\_GUARDRAILS.md, and this file.  
      2. AI-05: The ticket being worked on (ID, Outcome, Technical Guidance) so the AI builds what the ticket asks and nothing extra.  
      3. AI-06: Only the files relevant to the task (the route, controller, service, and test you are changing), not the whole repo pasted into a chat.  
   2. Never Provide  
      1. AI-07: Secrets of any kind: .env files, API keys (Canopy, Gemini, Firebase Admin), service-account JSON, tokens, passwords.  
      2. AI-08: Real user data: emails, account details, or exports from the production Firestore database. Use made-up sample data or the test fixtures instead.  
   3. Prompting  
      1. AI-09: Ask for small, specific changes ("add a 404 ownership check to getProduct in productService.js and a Jest test for it"), not whole features in one prompt. Small changes are easier to review.  
3. **Reviewing Generated Code**  
   1. **Author (Before opening the PR)**  
      1. AI-10: Read every generated line. If you cannot explain what a line does and why it is there, rewrite it, remove it, or have the AI tool try to explain it to you. If you still cannot understand then try something else.  
      2. AI-11: Check it against the standards: folder structure and layers (ENG-01 to ENG-04), naming (Section 2), response and error formats (ENG-22, ENG-23), userId filtering (ENG-27), and the UI rules for any frontend work.  
      3. AI-12: Remove leftovers, AI tools commonly add: unused imports, placeholder TODOs, console.log, commented-out code, extra features not in the ticket.  
   2. **Reviewer**  
      1. AI-13: Review AI-assisted PRs with the same or greater care as any PR. Pay special attention to code that looks correct but calls functions, fields, or endpoints that do not exist in our codebase.  
      2. AI-14: The reviewer can ask the author to explain any part of the change. If the author cannot, the PR is not approved. This is to guarantee that authors know their code, just in case for a Q\&A section during sprint presentations  
4. **Validating Generated Dependencies and APIs**

	AI tools sometimes invent package names, functions, or API parameters that do not exist, or suggest outdated ones.

1. **Dependencies**  
   1. AI-15: Never install a package just because an AI suggested it. Confirm it exists under the exact name, is the real, popular package (watch for look-alike names), and meets the dependency rules ENG-35 to ENG-40.  
   2. AI-16: The developer, not the AI, decides to add a dependency, and names it in the PR description.  
2. **External APIs**  
   1. AI-17: Every call to an external service is checked against that service's official documentation, not the AI's description of it:  
      1. 

| Service | Verify |
| ----- | ----- |
| Canopy API | Endpoint, request parameters, response fields, error responses |
| Gemini API | Current model names, SDK package and method names, request format |
| Firebase Auth / Admin SDK | Method names and versions (verifyIdToken, etc.) |
| Firestore | Query methods, index requirements, field names matching our schema |

   2. AI-18:  
   3. AI-19: Internal APIs   
      1. Generated frontend code must call only endpoints that exist in ENGINEERING\_STANDARDS.md Section 5, with the documented request and response shapes.  
5. **Required Testing Before Generated Code is Accepted**  
   1. AI-20: AI-generated code meets the same testing rules as all code (ENG-41 to ENG-47): tests for new behavior, a negative path, and an ownership test for anything touching user data.  
   2. AI-21: The author runs npm run lint, npm run format:check, and npm test locally before opening the PR, and CI must pass before merge.  
   3. AI-22: If the AI also wrote the tests, the author checks that they are meaningful:  
      1. They make real assertions (not just "does not throw").  
      2. They fail when the code is broken: temporarily break the code once and confirm the test goes red.  
      3. They test our behavior, not the mock itself.  
   4. AI-23: The author manually tries the feature in the running app (local startup per the README) at least once before requesting review.  
6. **Retaining AI Session Transcripts**  
   1. AI-24: For every AI-assisted PR, the author saves the relevant AI session as a Markdown file in docs/ai-sessions/, named \<ticket\>-\<short-description\>.md (e.g. S1-012-target-authorization.md). It contains:  
      1. Tool and date  
      2. The prompts and the AI's responses (exported or copied), trimmed to the parts relevant to the PR  
      3. A short note on what was kept, changed, or rejected  
   2. AI-25: Before committing a transcript, remove anything covered by AI-07 and AI-08 (secrets, real user data).  
   3. AI-26: The PR description links to the transcript file. Inline autocomplete (Copilot suggestions) does not need a transcript; note "Copilot autocomplete" in the PR instead.  
   4. AI-27: Transcripts stay in the repository for the rest of the semester and are not deleted after merge. They are evidence for sprint reviews and retrospectives.  
7. **Situations Requiring Additional Security Review**

A PR needs a second reviewer (two approvals instead of one) and the security checklist below when AI-generated code touches any of these: 

1. AI-28: Authentication  
   1. Login, registration, password reset, token verification, the auth middleware.  
   2. AI-29: Authorization and data access  
      1. Authorization and data access: any Firestore query or write, ownership checks, anything that uses userId.  
   3. AI-30: Secrets and configuration  
      1. .env handling, Firebase Admin setup, API keys, config/ files.  
   4. AI-31: AI prompt construction  
      1. Code that builds the Gemini prompt or the relevance check. Review text from Amazon is untrusted input and could contain instructions ("ignore previous instructions…"); prompts must keep it clearly separated as data, and only the current user's selected product's reviews may be included.  
   5. AI-32: External API integration  
      1. Canopy and Gemini calls, including error handling and what gets logged.  
   6. AI-33: Input validation and error handling  
      1. Validators, the error middleware, anything that decides what a user sees when something fails.  
   7. AI-34: New dependencies, CI workflows (.github/workflows/), or deployment configuration.

	