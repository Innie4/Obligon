# Focused admin reviews

> 2026-10-26 · Redesign the administration pages and center record review and operation feedback.

## In short
Admin records now stay in compact lists, with decisions made in a centered review dialog. Feedback appears in the center of the admin workspace, and support requests identify the account type that submitted them.

## What changed
- `apps/web/components/admin-dashboard/AdminDialog.tsx` and `admin.css`: reusable centered dialog, sticky header, responsive layout and scoped design tokens.
- `AdminShell.tsx`, `AdminSidebar.tsx`, `AdminHeader.tsx`, `AdminRecords.tsx`: grouped navigation, page hierarchy and record lists.
- `AdminScreen.tsx`, `IntakeConsole.tsx`, `OperationsInbox.tsx`: modal reviews, current-view refreshes and truthful source labels.
- `AdminBenefits.tsx`, `CardApprovalQueue.tsx`, `DiscountApprovals.tsx`, `RecoveryReview.tsx`, `AdminModals.tsx`: focused review surfaces using the same frame.
- `apps/web/components/shared/StatusPopup.tsx` and `Toast.tsx`: optional center placement; other dashboards keep the default.
- `apps/web/app/admin/login/page.tsx` and `apps/web/lib/mock/admin-data.ts`: admin sign-in presentation and navigation copy.
- `apps/api/src/routes/support-admin.routes.js`: read-only role and organization metadata in support responses.
- Focused web regression tests and `apps/api/tests/admin-support.integration.test.mjs`: preserve permissions, payloads, review lifecycle and request provenance. The source manifest lists every changed test.

## How it works
1. A page loads existing records through its existing authenticated API.
2. A review button selects one record and clears feedback from completed work.
3. `AdminDialog` portals the review into the document. `useDialogFocus` contains keyboard focus, handles Escape and restores the opener after closing.
4. Feedback inside an open review, including sibling-section feedback, portals into that dialog. This keeps its dismiss and retry buttons within the same keyboard focus boundary.
5. Existing action handlers submit unchanged decisions. Refreshes use the current view, and pending work prevents another record from becoming the target.
6. Support labels use the ticket organization type and requester role. Unattributed records remain Unknown; public enquiries stay distinct.

## Why it's built this way
The app already had an established focus helper and notification provider. Extending their placement and reusing their behavior avoids another modal library. Admin-specific CSS and opt-in placement keep the other dashboards stable. Last-loaded card reviews remain mounted during refresh so their keyboard context survives.

## The concept worth knowing: lifecycle ownership
**Simply put:** a receipt belongs to the purchase that produced it, not the next customer at the counter.

**More precisely:** a popup follows the state and record that own it. Moving a feedback component between the page and a portal can remount it. Clearing completed feedback when entering a new review prevents an old success from appearing to describe a different record. Active progress stays owned by its original request.

## Watch out for
Support filters describe the latest loaded records, capped at 200. Browser state tests use isolated data and intercepted mutations; they do not prove real payment-provider behavior. Automated accessibility checks also leave items needing human assessment.

## Check yourself
1. Why must error feedback be inside an active review dialog?
<details><summary>Answer</summary>The focus trap would otherwise prevent keyboard users from reaching its dismiss or retry control.</details>

2. What if an earlier save refreshes a captured, outdated search?
<details><summary>Answer</summary>It can overwrite the newest view. `latestLoad` refreshes the currently selected filter instead.</details>

3. Why preserve Unknown as a request source?
<details><summary>Answer</summary>A missing role is not evidence of a customer account. Guessing would misclassify requests.</details>

## Explain it back
Without looking at the code, explain in 2-3 sentences what this change does and why it works. If you get stuck, that's the part to reread.

*Made with Edirae Learn · edirae.com*
