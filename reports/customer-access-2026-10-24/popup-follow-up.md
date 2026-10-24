# My Card popup follow-up

2026-10-24. Base release: `9a08c00982a3dd840c282b3f1d8133be1dc3cee8`.

Live verification found a paid applicant without an issued card could see both identity collection and the automatic monthly budget popup. `CustomerScreen` now waits for a non-null card status before automatically opening the budget prompt. The card status is included in the effect dependencies. Explicit budget editing is unchanged and continues to require the paid budget entitlement.

Acceptance: loading and confirmed no-card states suppress the automatic budget popup; issued-card loading enables it only on My Card; dismissal does not reopen it that month; manual editing remains available before card issuance.

The new focused regression failed on the published source (2 passed, 1 failed). After the source correction, all 19 My Card tests and all 681 web tests passed. TypeScript passed after build generation completed. The optimized production build succeeded with existing warnings. The first sandbox full-suite run could not bind its localhost HTTP fixture; the authorized unsandboxed run passed. An initial TypeScript check overlapped build regeneration and reported missing generated files; the sequential check passed. There were no application changes for either environment issue.

Independent read-only review traced card loading, callbacks, automatic effect dependencies, manual editing, entitlement/payment-return guards and dismissal; no actionable findings. No API, database, payment, authorization or configuration changes are included. The approved original 71-file manifest is unchanged; the separate JSON manifest identifies this follow-up.

Release uses the existing Git-connected hosts. If the focused UI change breaks My Card, revert this UI commit through Git and redeploy; retain the existing schema and financial data. No timed rollback drill or canary facility has been demonstrated. GitHub Actions is blocked by the account billing lock, so local evidence and host build status are reported separately. Do not enable programme funding, scheduled settlements or issuing credentials as part of this correction.

Deployment and final live popup check will be recorded in release.md.
