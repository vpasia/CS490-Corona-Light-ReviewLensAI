# S2-015 — Questions about another product or platform

**Tool and date:** Codex, November 20, 2026

**Request:** Implement [issue #58](https://github.com/vpasia/CS490-Corona-Light-ReviewLensAI/issues/58). Reuse the review Q&A builder and shared evaluation cases. Exercise another product, another platform, a comparison that needs outside evidence, and an in-scope control.

**What changed and why:** The existing prompt already declines questions about another product or platform. It now also says to answer comparisons only when the supplied reviews contain the needed evidence. The [ticket fixture](../../apps/backend/tests/fixtures/reviewQaEntityScope.json) takes three questions verbatim from the team's `qa_scope_evaluation_set.json` at commit `396e6ea` on `origin/feature/scope-guard-fixture`. It adds a plausible battery-life comparison between the active headphones and a model absent from the supplied reviews.

**What the tests proved:** The Jest cases verify that each request carries the active product and Amazon platform, the scope and comparison instructions, and the evidence and question as separate parts. The live run used the same request builder and the existing Git-ignored runner's synthetic SoundTrail H1 Amazon reviews. All four requests returned HTTP 200 on the first attempt with `gemini-3.5-flash-lite`. The app's model configuration stayed as configured.

## Actual live replies

**Another product — “What do customers think about a product that is not included in the provided Amazon product data?”**

> I can only answer questions about the SoundTrail H1 Headphones using the supplied Amazon reviews. I cannot discuss products not included in the provided data.
>
> If you have any questions about the SoundTrail H1 Headphones based on their reviews, I would be happy to help!

**Another platform — “What do Walmart customers say about this product?”**

> I can only provide information based on the reviews provided for the active target, SoundTrail H1 Headphones on Amazon. I cannot answer questions about Walmart customers or platforms other than Amazon. If you have any questions about the supplied Amazon reviews for the SoundTrail H1 Headphones, please feel free to ask!

**Comparison — “Based on Amazon reviews, how does the SoundTrail H1 compare with the SoundTrail H2 for battery life?”**

> I cannot answer this comparison because the supplied reviews only contain information about the SoundTrail H1 Headphones and do not include any evidence regarding the SoundTrail H2.
>
> I can help you with the SoundTrail H1 Headphones using the supplied reviews. Please feel free to ask a question about them!

**Control — “What complaints do customers mention repeatedly in the reviews?”**

> Based on the provided reviews, customers repeatedly mention discomfort with the ear pads. Specifically, one reviewer notes that the ear pads "felt stiff" and another states that they "got uncomfortable after an hour."

The three refusals redirected to the active reviews, and the control cited the two synthetic complaints.

Backend lint and coverage passed with 192 tests. Removing the comparison instruction temporarily caused the new prompt tests to fail. Restoring it made them pass again.

To repeat the live run from the repository root in PowerShell:

```powershell
$cases = Get-Content -Raw -LiteralPath .\apps\backend\tests\fixtures\reviewQaEntityScope.json | ConvertFrom-Json
@($cases.question) + 'exit' | node .\apps\backend\node_modules\reviewQaScopeSmoke.mjs --interactive
```

**Pending:** Wire the prompt into the shared `POST /api/products/:productId/analyze` path when it lands. Verify that scoped refusals return HTTP 200 with `data.outOfScope: true` and that the Ask panel displays the result. The prompt change requires the second reviewer specified by AI-31 before merge.
