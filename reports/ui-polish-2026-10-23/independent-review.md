# Independent customer and partner Round 3 review

23 October 2026. Read-only review of the frozen eight-file manifest plus the subsequent two-file noun correction. Exact reviewed hashes are preserved in `evidence/independent-review.json`.

What this change does: It makes station lookup usable before a map loads, contains provider-loading failures, and improves the accuracy and readability of customer and partner screens. Financial values and existing API actions remain the source of the displayed records.

No remaining required source changes were found in this bounded review.

## Finding corrected during review

1. **Other partners were called station accounts** (`apps/web/components/dashboard/PartnerVerification.tsx:59`). The supported `other` specialization previously fell through to “station”, although it uses the separate PartnerAccountOverview flow. The implementation agent added an explicit “partner” noun for Other, preserving “workshop” for mechanics and “station” for fuel and gas partners. I inspected the exact delta and independently reran the 20-case verification tests. Verification decisions and requests remain unchanged. Status: resolved.

## Verified behavior

- The map SDK loader has a 12-second bound, validates its API shape, detaches script handlers, and removes failed scripts. SDK/map failures produce a visible fallback rather than hiding station data.
- Google tile events provide the readiness signal. OSM iframe load is labelled unverified, with full-map and station-list alternatives. Retry revisions and effect cleanup isolate old iframe events; listeners and markers owned by the component are removed.
- Three additional isolated lifecycle assertions passed: SDK completion after unmount creates no map or state update; timeout and retry reject a saved stale SDK callback; script network failure clears the pending timer.
- Partner tables derive Status presence once and use it consistently for headers, rows, and empty colspan. Existing row handlers retain the same row. Caller column counts match the inspected server record shapes, including the fourth Staff Access value.
- Customer station cards precede the optional map in document order. The explicit location action and existing granted-permission behavior remain; prompt-state mounting does not request GPS.
- Customer history renders the existing signed amount and balance labels unchanged, with nonbreaking currency cells. Overview Wallet and My Card destinations are real routes. Inactive-plan support provides My Card guidance while retaining the coordination submission contract for eligible users.
- Contact badges require a present contact value, preventing a missing phone from displaying Verified solely because of a stale flag. The account-verification decision itself was not changed in this UI correction.

Fresh focused tests: 7 map states, 26 dashboard UI, 11 partner regression, and 20 verification tests passed. Total: 64 cases, zero failures or skips. The three extra map lifecycle assertions also passed. Preserved logs and exact source identities are in `evidence/independent-review.json`.

Verdict: This bounded UI increment has no remaining source-review blocker from this pass. This verdict is not a whole-project release or readiness approval.

Not checked: Live map/provider availability, browser layout/visual scoring, production deploy, and whole-project readiness. Root owns the final browser capture and combined build. No code, backend, authentication, payment, or provider configuration was changed by this reviewer.

## Final unit and scroll-hint addendum

23 October 2026. Root subsequently made the last presentation correction: Partner SmallMetric groups approved unit phrases into smaller nonbreaking spans, Partner DataTable retains its scroll cue at wide widths, and Company Table shows its cue alongside desktop tables.

No findings or further source changes are required. Reversing just these three documented presentation edits in memory reproduces the exact SHA-256 identities of both previously reviewed component files. This proves that column data, status decisions, callbacks, requests and authorization behavior did not change in this increment. The new metric test checks that `2.5 standard m³ · 7 kg · 10 L` is preserved exactly when flattened; all 13 company/admin UI polish cases passed, with zero failures or skips.

Current hashes, prior-source comparison and raw output are saved in `evidence/final-units-scroll-independent-review.json`. Browser capture, complete web tests and build remain root evidence. This reviewer changed no source files.
