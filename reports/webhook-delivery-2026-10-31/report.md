# Flutterwave webhook delivery investigation

Base release: `b580d15e1cecfd4a5aa0668d8ba56026809e52b9`.

## Completion criteria

1. A provider-originated resend of the existing paid Company top-up reaches the correct receiver and receives HTTP 200.
2. Its durable event receipt is completed and its authenticated processing audit exists.
3. A second delivery leaves the original single NGN 100.00 wallet credit and balance unchanged.
4. Any source changes pass focused tests and independent review; the exact pushed revision is live on Render and Vercel.

Delivery remains unresolved at preparation of this report. A successful resend API envelope alone is not proof of receiver acceptance.

## Evidence and scope

The existing endpoint follows Flutterwave V3's documented exact `verif-hash` comparison. Rejections occur before provider lookup or accounting. Earlier safe diagnostics proved a real V3 header was present and differed from the running API configuration. The receiver accepted an earlier nonfinancial probe using its active configured value. The URL was previously corrected to `https://obligon.onrender.com/api/webhooks/flutterwave`.

The merchant's current Live V3 form, merchant identity, and paid transaction were inspected. Its extra custom-URL preferences concern failed transactions and refunds; they do not explain this `charge.completed` rejection. Render shows no dotenv override variables, mounted secret files, or linked environment groups. Both normal Node env-file and dotenv loading preserve deployment environment variables.

Browser password-field reads return a redaction placeholder. They cannot establish the saved provider secret's actual contents or equality. No credential value, digest, length, personal details, or raw payment payload belongs in this report.

## Diagnostic increment

`apps/api/src/routes/webhooks.routes.js` adds boolean-only shape information on rejected requests: duplicate V3 headers, matching byte length, surrounding whitespace/quotes, and equality after hypothetical trimming or unquoting. These transformations are diagnostic only. Exact authentication, HTTP responses, provider confirmation, ledger posting, and replay handling are unchanged.

`apps/api/tests/payment-webhook-recovery.integration.test.mjs` proves malformed equivalents still receive 401, logs contain booleans only, and rejected requests have no provider or wallet effects. Existing tests cover valid Company top-ups, duplicate/concurrent callbacks, rollback and retries, and mismatched payment evidence.

Verification: initial red run 11 passed and 2 failed on absent new diagnostics; final focused run 13 passed, 0 failed, 0 skipped. Syntax and `git diff --check` passed. An independent reviewer inspected connected configuration, middleware, raw-header handling, and test evidence and found no actionable issue.

## Release impact and recovery

This increment changes private rejection diagnostics only. It adds no dependency, migration, credential, permission, public response, or money-moving behavior. Existing user authorization covers its push/deployment. It does not establish financial readiness or provider delivery.

Rollback: select previous successful Render deployment `dep-dbj5cabncjis73d8m11g` at `b580d15`, and the prior Vercel Ready deployment `8CN8dzKJn2UzunuCQ3eSDMEB9DHw`, using their hosting dashboards. No schema rollback is needed. Stop the release if health fails or rejection logs reveal any credential/payload data. Free hosting offers no configured canary rollout; no five-minute recovery-time or load-test claim is made.

Live diagnostic result, any necessary configuration action, duplicate proof, and hosting receipts will be recorded after deployment. No new charge, payout, refund, scheduler activation, ledger correction, or unsigned webhook acceptance is authorized by this investigation.
