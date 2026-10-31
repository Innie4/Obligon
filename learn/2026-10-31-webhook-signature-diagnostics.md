# Diagnose a rejected payment webhook safely

> 2026-10-31 · Resolve Flutterwave delivery while preserving payment authentication

## In short

The webhook receiver now explains the shape of a rejected signature without recording the secret itself. This narrows a configuration problem while keeping the existing exact signature check in place. A diagnostic deployment alone does not prove that Flutterwave delivery works.

## What changed

- `apps/api/src/routes/webhooks.routes.js`: records boolean checks for duplicate headers, matching byte length, outer whitespace, surrounding quotes, and hypothetical normalized equality.
- `apps/api/tests/payment-webhook-recovery.integration.test.mjs`: tests these diagnostics and proves normalized or duplicate secrets remain rejected without provider lookup or wallet effects.
- `reports/webhook-delivery-2026-10-31/report.md`: records acceptance criteria, evidence, deployment impact, and recovery instructions.

## How it works

1. A request arrives at the existing Flutterwave route and rate limiter.
2. `verifyWebhook` runs the existing exact comparison against the configured V3 secret.
3. If it rejects the request, the route computes structural flags. Equal-length candidate comparisons use `crypto.timingSafeEqual`.
4. Only true/false values are logged. The route returns the same HTTP 401 response.
5. Valid exact signatures continue through provider confirmation and the existing durable event processing without entering this diagnostic block.

## Why it is built this way

Trimming or removing quotes before accepting a request would silently change authentication. Here those operations only answer diagnostic questions. A positive normalized-match flag points to configuration formatting that needs correction; it never authorizes a payment.

The tests use an isolated PostgreSQL database and provider fixtures. They include real Node HTTP duplicate headers so the test observes the same header joining that the server receives.

## The concept worth knowing: observability

Think of a locked door with a light that explains why a key failed. The light helps someone repair the key or lock without opening the door.

Precisely, observability means exposing enough information to explain a system's behavior. These flags distinguish duplicate headers and formatting differences while withholding credentials, payloads, and identifying data. Authentication remains the separate decision that controls access.

## Watch out for

- Passing local tests does not establish that the provider and deployment use the same secret.
- Password-field redaction cannot prove saved-secret equality.
- A provider resend can return HTTP 200 while embedding the receiver's failure. Check the durable receipt, audit, and unchanged wallet ledger.
- The focused suite passed 13 tests. Live delivery was then separately confirmed twice, including one duplicate, with a completed receipt and a single unchanged wallet credit. Flutterwave's native log reports HTTP 200.

## Check yourself

1. Why can a trimmed-match flag be true while the request still gets 401?
<details><summary>Answer</summary>The flag explains a possible formatting mismatch. Only the original exact signature check can authorize the request.</details>

2. What if the same successful payment event arrives twenty times?
<details><summary>Answer</summary>The existing durable event processing and wallet completion must preserve one principal credit. Diagnostic flags do not replace those accounting protections.</details>

3. Why avoid logging the rejected header?
<details><summary>Answer</summary>It may contain a real credential. Boolean comparisons can answer the investigation's questions without copying that credential into operational logs.</details>

## Explain it back

Without looking at the code, explain in 2-3 sentences what this change does and why it works. If you get stuck, that's the part to reread.

*Made with Edirae Learn · edirae.com*
