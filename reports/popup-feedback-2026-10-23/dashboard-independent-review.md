# Independent review: dashboard popup consumers

What this change does: customer, partner/workshop, company and admin request feedback now uses the shared floating popup. Existing forms, field validation, state guards and read/retry actions are retained.

## Findings

No actionable blocker found in the 21-file presentation delta versus `/tmp/obligon-approved-source23`. No source was edited during this review.

## Evidence

- Inspected every changed consumer using the approved-source diff and an AST inventory of new popup conditions, messages, and actions. All existing `disabled`, `aria-invalid`, `aria-describedby`, and `onSubmit` attributes match the approved inputs after whitespace normalization in all 21 files.
- Retry actions retain their original callback and read scope: payment settings, authorized members/cards, support conversations, card status, bank directories, station lists/prices, API access, map construction/tiles and subscription reloads. The added Overview card-status retry invokes the existing `refreshCard`, which reads `/api/customer/card`.
- No new automatic mutation retry or request side effect was introduced by the popup declarations. Existing submission locks, disabled controls and form close restrictions remain in place.
- Company allocation uncertainty retains the same payload/request-key explanation and manual retry. Refund review, pending card requests, verification progress, issuance limitations and actual record statuses remain page content. New progress copy does not claim completion of payments or issuer actions.
- New popup messages do not interpolate passwords, PINs, authenticator setup secrets, backup codes, BVN or fuel authorization codes. Actual verification and fuel codes remain in their existing authorized record views.
- Modal popup anchors remain within their owning dialog, with the shared component targeting that dialog for its portal. The consumer delta adds no focus call, backdrop or keyboard trap. Field-level error IDs and associated inputs remain intact.

## Limits

This review did not run a build, browser, deployment, provider request or repeated test suite. Exact viewport overlap, virtual-keyboard behavior and rendered focus acceptance belong to the parent task's browser checks; source inspection alone cannot prove those physical properties. Root's separate contract check covers unchanged critical service inputs. The worker's focused test results should be included in final acceptance.

Verdict: no source-review blocker for this presentation increment. Production deployment and broader launch-readiness conclusions require the parent task's acceptance evidence.
