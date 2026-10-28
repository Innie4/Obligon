# Admin access and review workflows

> 2026-10-28 · Select administrator access, organize review boards and require authorized ticket closure.

## In short
Administrators now receive a required role and explicit page access. Operations and discount boards separate work by status, while customer benefits expose usable funding and repair steps.

## What changed
- `packages/shared/admin-access.mjs` and `.d.mts`, API `middleware/admin-access.js`, `routes/admin.routes.js`, `routes/auth.routes.js`, both seed scripts and web `lib/services/types.ts`: canonical grants, current session metadata and audited staff changes.
- Migrations `046_admin_page_access.sql`, `047_support_close_approval.sql` and `048_discount_effective_end.sql`: access defaults, closure history/revisions and preserved requested discount dates.
- Web `components/admin-dashboard/`: new `AdminBoard.tsx` and `AdminStaffFields.tsx`; updated shell, sidebar, header, screen, operations, discounts, benefits and `admin.css`. `lib/dashboard-search.ts` filters destinations by access.
- API `routes/support-admin.routes.js`, `routes/discount.routes.js`, `routes/fuel-checkout.routes.js` and `lib/discounts.js`: approved closure and effective discount windows. Partner `components/dashboard/StationDiscounts.tsx` displays those same windows and refreshes time-based labels.
- API and web test groups cover access, boards, closure, discounts, benefits and search. Existing card identity, refunds, customer plans, fuel checkout/sales/units, uploads, private-table permissions and prompt fixtures were updated without weakening their assertions. `reports/admin-workflows-2026-10-28/evidence/browser-fixture.mjs` supplies disposable browser data.

## How it works
1. Staff creation requires Super Admin, Supervisor or Staff and selected pages. Every admin API request reads the current database grants; hidden navigation alone never grants access.
2. Staff changes serialize inside a database transaction. The acting manager is checked again, changes are audited, self-lockout is rejected and one active Super Admin with staff access remains.
3. Staff request ticket closure. A Supervisor or Super Admin with Operations access approves or rejects it against the current ticket revision. New requester messages invalidate pending closure.
4. Collapsible boards group queued, active and closed tickets, and separate rejected or expired discounts. Reviews and feedback remain centered dialogs.
5. Replacing an approved discount records an effective end while keeping its requested end. Checkout and partner display use that effective window. Repair forms reuse existing quotes, preserve exact amounts and require loaded records and a verified mechanic.

## Why it's built this way
Database checks revoke access without waiting for tokens to expire. Migration 046 preserves existing unrestricted administrators once; future accounts receive no implicit access. Customer benefits remain because programme funding, repair quotes and recorded next steps connect their workflows.

## The concept worth knowing: compatible locks
Simply put, a doorway should let people check their tickets without blocking every person already checking theirs.

More precisely, message foreign keys take PostgreSQL `KEY SHARE` locks. The message trigger uses `FOR NO KEY UPDATE` to serialize ticket changes without conflicting with those checks. `FOR UPDATE` caused a reproduced concurrent-message deadlock.

## Watch out for
Web tests passed 758 cases; access, closure, discount, base admin and updated API fixture runs passed 16, 17, 12, 59 and 78 respectively. The production build passed. The broader initial API run had 22 fixture failures, subsequently covered by the passing focused rerun, and 13 optional HTTP smoke tests skipped. These results do not prove live provider delivery or financial launch readiness. Rolling back to old API code would ignore page grants.

## Check yourself
1. Why recheck grants after sign-in?
   <details><summary>Answer</summary>A previously issued token must not preserve revoked page access.</details>
2. What if a requester replies during closure review?
   <details><summary>Answer</summary>The trigger cancels pending closure and changes the revision, so stale approval fails.</details>
3. Why keep two discount end dates?
   <details><summary>Answer</summary>The requested date preserves history; the effective date controls the actual selling window.</details>

## Explain it back
Without looking at the code, explain in 2-3 sentences what this change does and why it works. If you get stuck, that's the part to reread.

---
*Made with Edirae Learn · edirae.com*
