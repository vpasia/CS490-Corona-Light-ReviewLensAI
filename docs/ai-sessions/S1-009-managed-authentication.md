# S1-009 / S1-010: Managed authentication (frontend)

- **Tool:** Claude (claude.ai)
- **Date:** 2026-11-08
- **Tickets:** S1-009, S1-010 (frontend half)
- **Branch:** S1-009-managed-authentication

## Prompts and responses (trimmed)

### 1. Firebase client and auth provider
**Prompt (summary):** Asked Claude to guide me through starting S1-009 using the team's engineering and UI/UX standards.
**Response (summary):** Claude proposed separate files for the Firebase client (`src/lib/firebase.js`), the auth context and hook (`features/auth/authContext.js`, `useAuth.js`), and the provider (`app/AuthProvider.jsx`). The files are separate because our lint rule only allows components in component files. Code omitted here; see the PR files.

### 2. Pages, route guard, router, and tests
**Prompt (summary):** Pasted the existing `input.jsx`, `form-field.jsx`, `card.jsx`, `button.jsx`, `main.jsx`, and `App.jsx` so the new code would use their real props.
**Response (summary):** Claude helped me write and clean up the login and register pages, the shared auth layout and form alert, validation and plain-language error helpers, `ProtectedRoute`, `AppRouter`, a temporary home page with sign out, and tests for each. It followed UX-04, UX-10 to UX-21 and the engineering test rules. Code omitted; see the PR files.

### 3. Fixing failing tests
**Prompt (summary):** Pasted the Vitest output: 5 tests failed with "Found multiple elements with the role button and name Sign in" and leftover "Private home" text in the ProtectedRoute test.
**Response (summary):** Claude explained that Testing Library was not cleaning up between tests, so earlier tests' pages stayed on screen. Fix: call `cleanup()` in an `afterEach` in `src/test/setup.js`. It also added the forgot-password page, its route, and tests for the register and forgot-password pages.

## What was kept, changed, or rejected
- **Kept:** All generated files, after I read them and checked that I could explain them. The login flow was tried by hand in the browser.
- **Changed:** Added the test cleanup step after the first test run failed.
- **Not done:** A loading spinner on the shared Button, and backend token verification (separate ticket).
- **Secrets / user data:** None included. Test accounts used throwaway emails.