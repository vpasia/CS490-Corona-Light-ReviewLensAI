# S1-021 AI session excerpt

Tool: OpenAI Codex / ChatGPT. Date: November 5, 2026 (America/New_York).

User: "help me do them ... explain to me step by step ... do not guess"
User: "nah can you do everything for me"
Assistant: "We’ll start with the review validation and normalization code, which can be built and tested independently."
User: "ok"
Assistant: "I’ll start #21 by building and testing the review normalizer—the code that checks review text and ratings before anything is saved. I’ll keep Canopy’s response format separate until I’ve verified it."

Kept: provider-independent normalizer, explicit invalid-record reasons, allowlisted
metadata, no source-supplied ownership, 10 behavioral tests.
Deferred: Canopy schema mapping, Firestore integration, endpoint/UI and run state.
Rejected: guessing provider fields or claiming isolated tests complete a story.
Validation: all 10 assertions passed under node:test with only the runner import
substituted. Deliberately weakening the rating boundary made a test fail.
Jest/lint/format/CI/live integration remain unverified. See integration notes.
The human author must review and understand every change before submitting a PR.
