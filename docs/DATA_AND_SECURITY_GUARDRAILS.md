> Shared-ASIN update for PR #36, November 10, 2026: implements the team decision recorded in PR #36 and Discord (14-day freshness). This revision supersedes the previous per-user-copy rule for public source reviews only. Two human security reviews remain required before merge.

**Data and Security Guardrails**
**Ticket: S1-003**
	This document defines ReviewLens ownership boundaries, authentication assumptions, authorization requirements, secret handling, and prohibited data-access patterns. The one rule to remember:
SEC-01:

- Every query and every write on user-owned data must be limited to the signed-in user. A user can never read, change, delete, or send to the AI anything that belongs to another user. If you are a new developer or an AI coding tool, every data-access change you make must preserve this.

\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

1. **Managed Identity Provider:**
   1. SEC-02:
      1. ReviewLens uses Firebase Authentication (email and password). Firebase handles registration, sign-in, password hashing, and password-reset emails. We never store or handle passwords ourselves.
   2. SEC-03:
      1. After sign-in, the frontend gets a Firebase ID token (a signed, short-lived JWT) and sends it on every API request:
         1. Authorization: Bearer \<Firebase ID token\>
   3. SEC-04:
      1. The backend verifies that token with the Firebase Admin SDK (verifyIdToken) on every protected request. Expired, malformed, or missing tokens get 401 UNAUTHENTICATED.
   4. SEC-05: Authentication Assumptions
      1. A request is authenticated only if the backend verified its token. A frontend "logged in" state means nothing to the backend.
      2. Tokens expire after about an hour; the Firebase client refreshes them automatically.
      3. Signing out on the frontend only removes the token locally; the backend still checks every token it receives.
2. **How Provider Identity Maps to Application Ownership:**
   1. SEC-06:
      1. The Firebase uid is the user's one and only identity in ReviewLens. Email is not an identifier (it can change).
   2. SEC-07:
      1. The auth middleware puts the verified uid on the request as req.user.uid. This is the only source of the current user's identity in backend code.
   3. SEC-08:
      1. Each user has a profile document at users/{uid}; its document ID is the uid. It is created on the first authenticated request if it does not exist.
   4. SEC-09:
      1. Every user-owned document stores the owner's uid in a field named userId, set by the backend from req.user.uid when the document is created. userId is never changed after creation.
3. **User-Scoped Entities:**

	Products and ingestion runs are user-scoped. Public Amazon reviews are shared by a backend-derived US ASIN through a server-only cache. Shared storage never permits access to another user's product or ingestion history.


| Collection | Owner Field | Also Linked by | Notes |
| ----- | ----- | ----- | ----- |
| users | Document ID \= uid |  | Profile (email, displayName, createdAt) |
| products | userId |  | One Amazon product being analyzed |
| reviews | None (shared public source data) | asin, cacheVersion | Read only after verifying ownership of a product with the same ASIN |
| reviewCaches | None (server-managed shared cache) | Document ID = ASIN | Active version, original fetch time, two-week expiry and import/cleanup lease |
| ingestionRuns | userId | productId, asin | Private history for one owned target; never shared |
| Any future user-owned collection | userId | parent ID | Must follow the same ownership rules |

1. SEC-10:
   1. Two users can analyze the same Amazon product (same ASIN). Each retains a separate user-owned products document. Public source reviews are reused by ASIN for 14 days after the original fetch. Reuse does not extend expiry. Private ingestion runs and future user-generated analysis are not shared.
   2. SEC-11:
      1. Private child records, including ingestion runs, carry userId and productId. Shared reviews carry asin and cacheVersion; the service verifies ownership of the requested product and derives its ASIN from the stored supported Amazon URL before reading that cache.
   3. SEC-12:
      1. Deleting a product removes that target and its private ingestion runs. Shared reviews are retained while any target references the ASIN. Last-reference cleanup coordinates with creation and import through the cache document, blocks new references while cleanup is pending, and can be retried after partial failure. Products marked deleting cannot start or complete imports.
4. **Where Authorization is Enforced:**

	Authorization happens on the backend, in three layers:

| Layer | What it Enforces |
| ----- | ----- |
| Auth middleware (middleware/auth.js) | Every “/api” route requires a valid token and sets req.user.uid. Only a health check (GET /api/health) is public. |
| Service layer (services/) | Every Firestore read and write includes the owner check (below). |
| Firestore Security Rules | Deny all direct client access. Only the backend (Admin SDK) touches the database. |

1. SEC-13: Owner Checks in Services
   1. Lists:
      1. Always filter by owner: .where('userId', '==', req.user.uid).
      2. Single document by ID (/products/:productId):
         1. Load it, then compare doc. “userId \=== req.user.uid”. If the document is missing or belongs to someone else, throw 404 PRODUCT\_NOT\_FOUND. Never 403 (the API must not confirm another user's data exists).
      3. Child resources (/products/:productId/reviews, /analyze, /import-reviews):
         1. First verify the user owns the product. Query private ingestion runs by both productId and userId. For shared public reviews, derive the ASIN server-side and select only the active cacheVersion for that ASIN; never accept an arbitrary client ASIN or return another user's target/run.
      4. Writes:
         1. Set userId from req.user.uid; updates and deletes run only after the ownership check.
   2. SEC-14:
      1. Ownership checks live in one shared helper (services/ownership.js, e.g. getOwnedProduct(uid, productId)) used by every service, not rewritten in each route.
   3. SEC-15:
      1. Firestore Security Rules are committed in firestore.rules:

         rules\_version \= '2';

         service cloud.firestore {

           match /databases/{database}/documents {

             match /{document=\*\*} {

               allow read, write: if false;   // all access goes through the backend

             }

           }

         }

   4. SEC-16:
      1. AI context is authorization too. The Gemini prompt is built on the backend from reviews fetched with the owner checks above, for the one selected product only. The frontend never sends review text to be analyzed.
   5. SEC-17:
      1. Frontend route guards (redirecting signed-out users to /login) are for user experience only. They are not security; the backend must be safe even if the frontend is bypassed.
5. **Why Client-Supplied Ownership Identifiers Are Not Trusted:**
   Anything that comes from the browser can be changed by the user. Developer tools, Postman, or curl can send any body, query string, or header.
   1. SEC-18:
      1. The backend ignores any userId, ownerId, or similar field in request bodies, query strings, or headers. Request validation strips them. Identity comes only from the verified token (SEC-07).
   2. SEC-19:
      1. IDs in the URL (productId) are only lookup keys, never proof of permission. Every one is ownership-checked (SEC-13).

   Example of the attack this prevents:



- User B sends:  GET /api/products/A\_PRODUCT\_ID/reviews

  POST /api/products  { "userId": "u\_A1", ... }


  Without these rules, B could read A's reviews or create data in A's account. With them, the first request returns 404 and the second creates a product owned by B, because userId comes from B's token.

6. **Secrets and Environment Configuration:**
   1. SEC-20:
      1. All environment-specific values come from environment variables, never source code (ENG-25).



| Secret / Setting | Lives in | Visible to Browser |
| ----- | ----- | ----- |
| CANOPY\_API\_KEY | Backend .env / Render env vars | Never |
| GEMINI\_API\_KEY | Backend .env / Render env vars | Never |
| Firebase Admin service account (FIREBASE\_PROJECT\_ID, FIREBASE\_CLIENT\_EMAIL, FIREBASE\_PRIVATE\_KEY) | Backend .env / Render env vars | Never |
| VITE\_FIREBASE\_\* web config (apiKey, authDomain, projectId) | Frontend .env | Yes, this is public by design. Security comes from token verification and Firestore rules, not from hiding it |
| VITE\_API\_URL | Frontend .env | Yes |



   2. SEC-21:
      1. Any variable starting with VITE\_ is bundled into the browser. Never put a secret in a VITE\_ variable.
   3. SEC-22:
      1. “.env” files are in ".gitignore" and never committed. “env.example” is committed with every variable name and blank or fake values.
   4. SEC-23:
      1. Production secrets are set in the Render dashboard (backend) and are shared with teammates privately, never in Discord channels, issues, PRs, or AI tools (AI-07).
   5. SEC-24:
      1. GitHub secret scanning and push protection are enabled on the repository.
   6. SEC-25:
      1. If a secret is ever committed or exposed, rotate it immediately (generate a new key, revoke the old one) and tell the team. Deleting the commit is not enough
   7. SEC-26:
      1. CI uses no real secrets. Tests mock Firebase Admin, Canopy, and Gemini (ENG-44).
   8. SEC-27:
      1. Secrets, tokens, and full review text are never logged or returned in error messages (ENG-32, ENG-15).
7. **Testing Cross-User Isolation:**
   Every endpoint that touches user data has isolation tests (ENG-43). Tests use two fake users, A and B, by mocking verifyIdToken to return uid user-A or user-B depending on the test token. No real Firebase is used.
   1. SEC-28: Required test cases for each user-owned resource:
      1.

| \# | Scenario | Expected |
| :---: | ----- | ----- |
| 1 | No token | 401  |
| 2 | Invalid or expired token | 401  |
| 3 | B lists products | Only B's products; none of A's |
| 4 | B gets A's product by ID | 404  |
| 5 | B deletes A's product | 404, and A's product still exists |
| 6 | B reads A's product reviews | 404  |
| 7 | B imports reviews into A's product | 404, and the Canopy mock was not called |
| 8 | B asks a question on A's product | 404, and the Gemini mock was not called |
| 9 | A asks a question on A's product | The prompt sent to the Gemini mock contains only A's reviews for that product |
| 10 | B creates a product with "userId": "user-A" in the body | Product is created with userId: "user-B" |

      2.
   2. SEC-29:
      1. Test names state the isolation being proven, e.g. returns 404 when user B requests user A's product.
   3. SEC-30:
      1. A PR that adds or changes a user-data endpoint is not approved without the matching rows from the table above.

\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_
**Prohibited Data-Access Patterns**
Never do any of the following. Reviewers reject PRs that contain them.

| Prohibited | Do Instead |
| ----- | ----- |
| Unscoped reads of user-owned data | Filter private records by userId; shared review reads require an owned target, ASIN and active cacheVersion. Server-only migration and last-reference maintenance may inspect target references without returning them to clients. |
| Loading a document by ID and returning it without checking userId | Use getOwnedProduct (SEC-14) |
| Reading userId from req.body, req.query, or headers | Use req.user.uid (SEC-07, SEC-18) |
| Fetching shared reviews from a client-supplied ASIN without ownership verification | Resolve the ASIN from the owned product and select its active cacheVersion (SEC-11) |
| Returning 403 for another user's resource | Return 404 (SEC-13) |
| Building an AI prompt from reviews the frontend sent, or from more than one product | Fetch the selected product's reviews on the backend (SEC-16) |
| Reading or writing Firestore directly from the frontend | Call the backend API (SEC-15) |
| Putting a secret in source code, a VITE\_ variable, logs, or an AI chat | Backend environment variables only (SEC-20 to SEC-23) |
| Sharing private product documents, ingestion runs or user-generated content | Share only public source reviews by backend-derived ASIN (SEC-10) |
| Relying on frontend route guards for security | Enforce on the backend (SEC-17) |
