# Frontend acceptance evidence

23 October 2026. Base revision: `a27caac`. This records local checks of the uncommitted payments, partner subtype and station selling-unit work. It does not verify the hosted release.

This is the initial frontend subagent checkpoint. The subsequent patched-runtime build, tests and isolated API setup are recorded in `local-ui-fixture.md` and `evidence/frontend-final-verification.json`. The root agent owns visual checks through its distinct working in-app browser session; this subagent's browser failure does not establish that root's browser is blocked.

## Verified locally

- Production build: exit 0. Compiled successfully and generated all 78 static pages. The new workshop and admin Operations routes are included.
- Web regression suite: 485 tests passed, 0 failures, 0 skipped. The complete log is `evidence/frontend-web-tests.log`.
- TypeScript: the no-emit check completed successfully with no diagnostics. The production build also checked types.
- Whitespace/diff validation passed before browser acceptance.

The regression suite covers subtype navigation and route decisions, mechanic workshop editing and viewer restrictions, mechanic staff POS permission removal, gas signup and gas-only product options, explicit unit requests and approvals, pending-unit pricing restrictions, exact recorded POS quantity/unit display, customer checkout units and receipts, company locator units, and the bounded admin recovery controls. These are automated component/contract checks, not screenshots or live provider acceptance.

## Browser acceptance blocked

Chrome could not load its request-header policy. The first inventory failed for both available Chrome profiles. Selecting Chrome returned its API documentation, but the subsequent session operation and an explicit attempt to open `http://127.0.0.1:4310` failed with the same condition. No application tab was reached. Repeating the same failing path was stopped.

Consequently, no fresh desktop or 390 px visual, keyboard, overflow, console or real HTTP acceptance evidence was obtained for the following requested checks:

| Area | Browser checks still required |
| --- | --- |
| Mechanic partner | Workshop owner save; viewer read-only state; Account navigation; forbidden direct routes and search results |
| Gas station partner | Profile product/unit requests; pending and approved pricing; POS quantity and receipt labels |
| Admin | Operations recovery UI; intake selling-unit choices; mobile layout |
| Company | Station locator prices and selling-unit labels |

No local or hosted account, payment, OTP or provider operation was performed during this browser attempt. No browser viewport was changed and no screenshots were created. The blocker receipt is `evidence/frontend-browser-blocker.json`.

## Build warnings and remaining boundaries

The successful build still reports an inferred workspace root/multiple lockfiles and lint warnings, mainly unused symbols. It also reports an image optimization warning and a hook-cleanup warning. The full build output is preserved as `evidence/frontend-production-build.log`; a successful build does not establish that every page is free of defects.

Hosted deployment parity, real provider acceptance, role-specific live accounts, actual device/browser behavior, and qualified review of the exact authorization/payment patch remain separate release checks. No push or deployment was performed by this frontend acceptance task.

## Completed fallback acceptance

Root subsequently accessed the Codex in-app browser and completed the local browser scenarios recorded in `evidence/browser-acceptance.json`. The earlier Chrome blocker remains accurate for Chrome, but no longer means all visual checks are blocked. Final screenshots show workshop owner/viewer, gas units/POS/pricing, admin recovery/unit review, and company locator. Pricing overflow and suffix wrapping discovered visually were fixed and verified at 320,390 and1440px. No financial browser submissions were made. The isolated servers/schema were then removed.
