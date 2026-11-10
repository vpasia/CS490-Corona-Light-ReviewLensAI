# AI session: S1-019–023 shared ASIN revision

Tool: OpenAI Codex / ChatGPT. Date: November 10, 2026.

Relevant user/team instructions: review current PRs/comments; implement the confirmed ASIN-sharing change in PR #36; Jerome handles the product-creation ASIN hotfix. Vincent specified two-week expiry, reuse of fresh reviews and retention while other targets reference the ASIN. Christian added deletion/import protection in #12; integration must preserve it.

Assistant work retained: shared parser, server-derived product ASIN, ASIN cache metadata, private ingestion runs, cache reuse without extending TTL, publication fencing, deduplication, deletion-aware admission/final writes, coordinated reference cleanup, dry-run migration, updated guardrails/integration contract and mocked tests. ProductService includes the ASIN-aware deletion service for coordination with #12; route/controller ownership is unchanged.

Choices clarified: do not delete the old cache before a replacement is successfully fetched/committed; do not treat arbitrary old saved timestamps as proof of a fresh scrape; do not promote synthetic database-test reviews; do not claim a route or live test exists when only services/offline tests were verified. Direct saveReviews calls now fail explicitly and must use the coordinator.

Validation: backend Jest suite, ESLint and Prettier locally; targeted mutation checks for cache reuse and deleting-target protection. No real secrets, private service-account data, live review exports or live database writes were used in this session. User must run the tests locally and understand/review the code; two human security approvals are required before merge.
