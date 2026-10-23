# Final dependency and search follow-up

23 October 2026. Base: pushed source revision `0121bf255dbe52d326cdb6a42ab116c8dff86430`. This follow-up is recorded separately from the original approved snapshot and initial popup release.

## Dependency alert

GitHub reported a high-severity Zod advisory during the push. The refreshed registry audit confirmed `GHSA-mrhx-c7xc-m3w5`, updated/reviewed on 23 October at 18:26 UTC, affecting versions below 4.6.6. The earlier zero-finding audit is historical evidence and does not supersede this later finding.

`apps/api/package.json` now pins Zod 4.6.6, with its generated lockfile resolution. The application still imports the default `zod` entry point. No application parser, authentication, authorization, money, database or CI logic was changed for this dependency remediation.

The three direct consumers use environment scalar/object validation, Google email validation, and a validation middleware with no current callers. A bounded compatibility comparison found equivalent normalized outputs/rejected field names in 15 synthetic environment cases, identical acceptance in 22 email cases, and the retained `flatten().fieldErrors` interface. This sample is not proof that every Zod 3 and 4 behavior is identical. Error wording and uncommon inputs can differ.

The patched default entry rejected a bounded oversized collection before visiting its elements. The legacy `zod/v3` entry still visited every element, so switching imports to that entry was rejected as an unproven remediation. Both fresh full and production-only advisory audits now report **zero findings**. See [advisory](evidence/zod-advisory.json), [compatibility receipt](evidence/zod-compatibility.json) and [audit](evidence/dependency-audit-all.json).

## Search feedback

The live search check exposed progress/error text still inside the result dropdown. The shared search now uses loading/error popups while retaining available results, result counts, stale-response checks and authorized destinations. Retry remains the same read callback. Desktop keyboard users can reach the body-portal Retry control; Shift+Tab returns to Clear/input; leaving the search or its popup closes the dropdown. Mobile feedback remains in its dialog. Progress is non-dismissible and settles automatically.

Independent review caught and closed keyboard reachability and progress-dismissal issues. Chrome then verified the real input → Clear → Retry Tab sequence, Enter retry, restored input focus, and automatic popup removal on successful results. [Search report](../popup-feedback-2026-10-23/dashboard-search/report.md).

## Fresh acceptance and corrected evidence scope

The complete API rerun exposed six obsolete UI-source assertions in two API test files. They checked old settlement wording, table markup, search wording and inline verification alerts. Assertions now follow the implemented UI while retaining action callbacks, destination verification, matched table columns, authorized search destinations, six-digit verification and `aria-invalid` checks. Independent review found no weakened financial/access guards. Focused recheck passed 99 cases.

This demonstrates a limit in the earlier evidence-reuse decision: two API suites read web source, so unchanged backend hashes alone were insufficient to reuse the entire API suite. The final acceptance reruns all tests. One subsequent command omitted the general disposable `DATABASE_URL`, causing three SQL timezone tests to attempt the default local port; setting both database variables correctly resolved that test-environment error. Both failed intermediate logs are retained.

Final results: **646/646 web tests; 1,251 API tests passed, 13 opt-in live smoke checks skipped; production build passed.** No real provider transaction or destructive production test was performed. Existing lint/workspace-root warnings and previously listed launch requirements remain.

See [fresh receipt](evidence/followup-verification.json), [six-file source delta](followup-changes.diff) and [complete final source hashes](followup-source-manifest.json). The dependency bump is a version-only Edirae Learn skip; search logic is covered by the existing popup learning note.
