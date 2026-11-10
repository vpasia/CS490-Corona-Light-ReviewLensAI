# S1-016 (frontend follow-up): Match the Amazon link rules to Canopy

- **Tool:** Claude (claude.ai)
- **Date:** 2026-11-09
- **Ticket:** S1-016 (frontend side), follow-up to S1-015
- **Branch:** S1-016-frontend-canopy-url-rules

## Prompts and responses (trimmed)

### 1. Aligning the frontend with Canopy
**Prompt (summary):** Pasted the team's Discord thread: the backend's Canopy calls accept only https links on amazon.com or www.amazon.com with /dp/ or /gp/product/ and a 10-character ASIN, and the backend validation and frontend should match.
**Response (summary):** Claude identified that the frontend validation still allowed regional Amazon sites and http, and rewrote `validateProductInput` to require https, amazon.com or www.amazon.com, a product path with a 10-character ASIN, and no embedded tabs or newlines (the URL parser would otherwise silently strip them). It updated the form's helper text and the tests. Code omitted; see the PR files.

## What was kept, changed, or rejected
- **Kept:** the rewritten validation, the updated helper text, and the updated tests, after I read them and could explain them.
- **Changed:** the old accepted regional link test was removed, and new rejections were added for http, regional sites, subdomains, and embedded tabs.
- **Not done:** backend validation (Christian's ticket).
- **Secrets / user data:** none included.