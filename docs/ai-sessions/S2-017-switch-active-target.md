# S2-017: Switch the Active AnalysisTarget (frontend)

- **Tool:** Claude (claude.ai)
- **Date:** 2026-11-20
- **Ticket:** S2-017
- **Branch:** S2-017-switch-active-target

## Prompts and responses (trimmed)

### 1. Building the product switcher
**Prompt (summary):** Asked Claude to do S2-017 as the last of my four Sprint 2 tickets.
**Response (summary):** Claude noticed that the workspace page is already keyed by product ID, so everything on it resets when the URL changes. It added `TargetSwitcher.jsx` (an "Active product" dropdown built from the user's own product list that navigates to the chosen product's workspace) and two small anchored edits to `ProductWorkspacePage.jsx` (an import, and the switcher below the product header) instead of replacing the file, to avoid overwriting merged work. The switcher shows nothing when there is only one product, while loading, on a load error, or when the current product is not in the list. Tests cover the switcher and the full page: after switching, the new product's own reviews and import status load and the previous product's state is gone. Code omitted; see the PR files.

## What was kept, changed, or rejected
- **Kept:** the switcher and all tests, after I read them and could explain them. Manual testing is pending backend/API migration completion. Automated frontend tests cover product switching and state isolation.
- **Changed:** nothing beyond running Prettier.
- **Not done:** the left sidebar from the UI/UX standards (UX-01), and a product list refresh when a product is added elsewhere (the list reloads each time the workspace opens).
- **Secrets / user data:** none included.