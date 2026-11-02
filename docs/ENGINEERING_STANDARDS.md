**Engineering Coding Standards**  
**Ticket: S1-001**  
	The following document describes the conventions that developers and if used, AI coding tools must follow when working on ReviewLens. It describes what should be followed, not advice in order to make our code easier to follow and work with in the case that some tickets depend on others.

**For AI Coding Tools**:

- Read this file before generating code. Follow the folder structure, naming, response formats, and testing rules below exactly. Do not add dependencies, change config files, or introduce new patterns without the developer explicitly asking.

\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

1. **Our Stack**  
   1. 

| Layer | Choice |
| ----- | ----- |
| Frontend | React \+ Javascript |
| Styling | shadcn/ui |
| Backend | [Node.js](http://Node.js) and Express.js |
| Database | Cloud Firestore |
| Authentication | Firebase Authentication |
| Review Ingestion | Canopy AI |
| AI | Gemini 3.5 Flash Lite (relevance check), Gemini 3.8 Flash (analysis) |
| Hosting | Firebase Hosting {frontend}, Render {backend} |
| Lint / Format | ESLint \+ Prettier  |
| Testing | Vitest \+ React Testing Library {frontend}, Jest \+ Supertest {backend} |

2. **Repository and Folder Organization**  
   1.   
      frontend/  
        src/  
          app/           \# router, providers, layout shell (sidebar)  
          features/      \# one folder per feature  
            auth/  products/  reviews/  chat/  profile/  
          components/ui/  \# shared, reusable UI components  
          lib/api.js      \# the ONLY module that calls the backend  
      backend/  
        src/  
          config/         \# environment loading, Firebase Admin setup  
          middleware/    \# auth, validation, error handler, request logging  
          routes/        \# URL → controller mapping only  
          controllers/   \# read request, call service, send response  
          services/       \# business logic; Firestore, Canopy, Gemini calls  
          utils/          \# AppError, logger, helpers  
        tests/  
      docs/               \# standards and context documents (this file)  
      .github/workflows/  CI  
   2. ENG-01:  
      1. Front-end code lives only in “frontend/” and backend code only in “backend/”.  
   3. ENG-02:  
      1. Front-end code is grouped by feature. A feature folder holds its pages, components and hooks (“features/products/ProductList.jsx”, “features/products/useProducts.js”).  
   4. ENG-03:  
      1. Backend code follows the layers routes, controllers, and services. Routes contain no logic. Only services access Firestore or external APIs  
   5. ENG-04:  
      1. Tests sit next to the code they test on the frontend (“ProductCard.test.jsx”) and in “backend/tests/” mirroring “src/” on the backend.  
3. **Naming Conventions**  
   1. 

| Item | Convention | Example |
| ----- | ----- | ----- |
| Variables, functions | camelCase | getUserProducts |
| React components and their files | PascalCase | ProductCard.jsx |
| Hooks | use \+ PascalCase | useProducts.js |
| Other JS files | camelCase | [productService.js](http://productService.js), authMiddleware.js |
| Constants | UPPER\_SNAKE\_CASE | MAX\_QUESTION\_LENGTH |
| Environment Variables | UPPER\_SNAKE\_CASE (frontend prefixed “VITE\_” | CANOPY\_API\_KEY, VITE\_API\_URL |
| Firestore collections | camelCase, plural | Users, products, reviews, analyses |
| Firestore fields | camelCase | userID, createdAt |
| API paths | Lowercase plural nouns, kebab-case | /api/products/:productId/import-reviews |
| Branches | Ticket ID \+ short description | S1-006-lint-and-test |
| Error Codes | UPPER\_SNAKE\_CASE | PRODUCT\_NOT\_FOUND |

   2. ENG-05:  
      1. Names say what something is or does. No abbreviations except common ones like ID, URL, or API.  
   3. ENG-06:  
      1. Boolean names read as yes/no questions like isLoading, hasReviews.  
4. **Formatting and Linting**   
   1. ENG-07:  
      1. Formatting is enforced by Prettier using the committed .prettierrc, not by editor settings:  
         1. { "semi": true, "singleQuote": true, "trailingComma": "all", "printWidth": 100, "tabWidth": 2 }  
   2. ENG-08:  
      1. Linting uses ESLint (flat config, [eslint.config.js](http://eslint.config.js)) in each package:  
         1. Frontend: @eslint/js recommended \+ eslint-plugin-react \+ eslint-plugin-react-hooks  
         2. Backend: @eslint/js recommended with Node globals  
         3. Prettier compatibility via eslint-config-prettier  
   3. ENG-09:  
      1. Every package exposes the same scripts:  
         1. 

| Command | Purpose |
| ----- | ----- |
| npm run lint | Report lint errors |
| npm run format | Auto-format all files |
| npm run format:check | Fail if anything is unformatted |
| npm test | Run unit tests |

         2.   
   4. ENG-10:  
      1. CI runs lint, format:check, test, and build on every pull request. A PR with any failure cannot merge.  
   5. ENG-11:  
      1. Do not disable lint rules inline (// eslint-disable) without a comment explaining why.  
   6. ENG-12:  
      1. Use “async/await”, not “.then()” chains. No commented-out code in merged PRs.  
5. **Error-Handling Conventions**  
   1. Backend  
      1. ENG-13:  
         1. Errors are thrown as AppError(status, code, message, details?) from utils/AppError.js. Services throw; they never send responses.  
      2. ENG-14:  
         1. One error-handling middleware (middleware/errorHandler.js) turns every error into the standard error response (Section 5). Controllers never build error responses by hand.  
      3. ENG-15:  
         1. Unknown errors return 500 INTERNAL\_ERROR with a generic message. Stack traces and internal details are logged, never sent to the client.  
      4. ENG-16:  
         1. Failures from Canopy or Gemini are caught in the service and rethrown as 502 UPSTREAM\_PROVIDER\_ERROR with a user-friendly message.  
      5. ENG-17:  
         1. Async route handlers are wrapped so rejected promises reach the error middleware (Express 5 does this automatically; otherwise use an asyncHandler wrapper).  
   2. Frontend  
      1. ENG-18:  
         1. “lib/api.js” converts error responses into a JavaScript “Error” carrying “code: and “message”. Components display “message”, never raw codes or stack traces.  
      2. ENG-19:  
         1. A 401 response signs the user out and redirects to the login page.  
      3. ENG-20:  
         1. Each page has a top-level error boundary so one crashing component does not blank the whole app.  
6. **API and Service Response Conventions**  
   1. ENG-21:  
      1. All endpoints live under “/api”, use JSON, and use REST nouns:  
         1. 

| Method | Path | Purpose |
| ----- | ----- | ----- |
| GET | /api/users/me | Current user |
| POST | /api/products | Add a product (Amazon URL or ASIN) |
| GET | /api/products | List my products |
| GET | /api/products/:productId | Get one product |
| DELETE | /api/products/:productId | Remove a product |
| POST | /api/products/:productId/import-reviews | Ingest reviews via Canopy |
| GET | /api/products/:productId/reviews | List stored reviews |
| POST | /api/products/:productId/analyze | Ask a question about the reviews |
| GET | /api/products/:productId/analysis | Get the cached analysis |

   2. ENG-22: Success Responses  
      1. Wrap the result in “data”:  
         1. { "data": { "productId": "abc123", "productName": "..." } }  
      2. Lists add pagination info:  
         1. { "data": \[ ... \], "nextCursor": "xyz", "count": 20 }  
   3. ENG-23: Error Responses  
      1. Always uses this shape:  
         1. { "error": { "code": "PRODUCT\_NOT\_FOUND", "message": "Product not found.", "details": \[\] } }  
   4. ENG-24: Status Codes  
      1. 

| Code | When | Example code |
| ----- | ----- | ----- |
| 200 | Success |  |
| 201 | Resource Created |  |
| 400 | Invalid Input | VALIDATION\_ERROR, INVALID\_AMAZON\_URL |
| 401 | Missing or invalid token | UNAUTHENTICATED |
| 404 | Not found or owned by another user | PRODUCT\_NOT\_FOUND |
| 409 | Conflicting operation | INGESTION\_IN\_PROGRESS |
| 502 | Canopy or Gemini failed | UPSTREAM\_PROVIDER\_ERROR |
| 500 | Unexpected server error | INTERNAL\_ERROR |

      2.   
   5. ENG-25:  
      1. Another user's resource returns 404, not 403, so the API never reveals that it exists.  
   6. ENG-26:  
      1. Request bodies and URL parameters are validated in middleware before reaching a controller. Validation failures return 400 VALIDATION\_ERROR with one details entry per field: { "field": "amazonUrl", "message": "..." }.  
   7. ENG-27:  
      1. The user ID always comes from the verified token (req.user.uid), never from the request body or query string. Every user-data query filters by userId.  
   8. ENG-28:  
      1. Out-of-scope chat questions are a normal 200 response with "outOfScope": true, not an error.  
7. **Logging Expectations**  
   1. ENG-29:  
      1. The backend logs with pino through “utils/logger.js” (JSON output; pretty-printed in development). “console.log” is not allowed in merged code as ESLint flags it.  
   2. ENG-30:  
      1. Every request is logged by pino-http with method, path, status, duration, and a request ID. The request ID is returned in the X-Request-Id header to help match user reports to logs.  
   3. ENG-31: Log Levels  
      1. 

| Level | Use For |
| ----- | ----- |
| error | Unexpected failures, 5xx responses, upstream API failures |
| warn | Handled problems worth noticing (rejected ownership access, rate limits) |
| info | Key business events (product created, reviews imported with count, analysis completed) |
| debug | Development detail; off in production |

   4. ENG-32:  
      1. Never log ID tokens, API keys, passwords, full request bodies, or full review text and AI prompts. Log identifiers and counts instead (productId, reviewCount, model name, latency).  
   5. ENG-33:  
      1. The log level comes from the LOG\_LEVEL environment variable (debug locally, info in production).  
   6. ENG-34:  
      1. The frontend does not ship console.log calls; unexpected errors are shown to the user per the UI/UX Standards.  
8. **Expectations for Adding Dependencies**  
   1. ENG-35:  
      1. Before adding a package, check whether the stack above or an existing dependency already covers the need.   
   2. ENG-36:  
      1. A new dependency must be actively maintained (release in the last year), widely used, MIT/Apache/BSD-licensed, and pass npm audit with no high or critical issues.  
   3. ENG-37:  
      1. Install into the correct package (“frontend/” or “backend/”) and the correct section (dependencies vs devDependencies for tools and test libraries).  
   4. ENG-38:  
      1. Commit the updated package-lock.json in the same PR. CI installs with npm ci.  
   5. ENG-39:  
      1. The PR description names each new dependency and why it was needed. Large or architectural additions (a state library, an ORM, a UI kit) need team agreement at stand-up first.  
   6. ENG-40:  
      1. AI coding tools must not add dependencies on their own; the developer decides.   
9. **Expectations for Testing New or Changing Behavior**  
   1. ENG-41:  
      1. Every PR that adds or changes behavior includes tests for it. Bug fixes include a test that fails without the fix.  
   2. ENG-42:  
      1. Tests should be done with a valid path (runs correctly) and an invalid path (results in an error due to a possible invalid action by a potential user).  
   3. ENG-43:  
      1. Any endpoint touching user data includes an ownership test: user B requesting user A's product gets 404, and user A's reviews never appear in user B's results or AI context.  
   4. ENG-44:  
      1. Tests never call real Canopy, Gemini, or production Firebase. Use mocks or saved fixture responses in tests/fixtures/.  
   5. ENG-45:  
      1. Backend: Jest \+ Supertest against the Express app. Frontend: Vitest \+ React Testing Library, testing what the user sees (text, roles), not implementation details.  
   6. ENG-46:  
      1. npm test runs headless with no manual steps, and must pass in CI before merge.  
   7. ENG-47:  
      1. Test names describe behavior, “returns 404 when the product belongs to another user.”

\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_  
Pull Request Checklist:

- Every description should include  
  - “Closes \#\<issue\> and the ticket ID (S1-0xx)  
  - What changed and why  
  - New dependencies or environment variables  
  - Security Impact or “None”  
  - How it was tested, including negative and ownership cases.

	