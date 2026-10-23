# Dashboard search that opens useful destinations

> 2026-10-23 · Connect customer, partner, company and admin search to permitted pages and actual records.

## In short

Every dashboard now has a shared search control that opens pages and selected recent records. Result links carry a visible filter into the destination page, so selecting a transaction or vehicle leads to useful content. Failed record lookups retain available results and explain what could not be searched.

## What changed

- `apps/web/components/shared/DashboardSearch.tsx`: desktop suggestions, mobile dialog, keyboard selection, debounce, retry and response freshness checks.
- `apps/web/lib/dashboard-search.ts`: bounded lookups through existing authenticated APIs, subtype and company-approval checks, record labels and destination URLs.
- `apps/web/components/shared/DashboardSearchQuery.tsx`: applies URL search changes without overwriting ordinary manual filter edits.
- Headers and shells: `components/dashboard/DashboardHeader.tsx`, `admin-dashboard/AdminHeader.tsx`, `company-dashboard/CompanyShell.tsx` and `customer-dashboard/CustomerShell.tsx`, under `apps/web`, connect each account's permitted destinations.
- The customer `CustomerScreen.tsx`, partner `DashboardScreen.tsx`, company `CompanyScreen.tsx` and admin `AdminScreen.tsx`, in their respective `apps/web/components` folders, consume the selected filter. Customer station requests preserve location coordinates.
- `apps/web/tests/dashboard-search-ui.test.cjs`, `dashboard-search-loader.test.cjs` and `dashboard-search-destinations.test.cjs`: interaction, response, scope and destination regressions. Related navigation fixtures retain their existing assertions.

## How it works

1. The control filters permitted navigation immediately. Queries with at least two characters also request supported records after a short delay.
2. Each source uses the existing account API. Independent failures are collected while successful results remain usable.
3. The UI accepts a response only for its current query, account and organization context.
4. Selecting a link opens its real route with a `search` parameter. The destination applies that value to its existing filter and resets pagination where necessary.
5. Reselecting the same record reapplies its filter; modified clicks retain normal browser behavior.

## Why it's built this way

Existing API permissions remain the source of access decisions. Reusing those APIs avoids introducing a second record index or a separate authorization model. The shared URL reader keeps back/forward navigation useful without resetting every keystroke typed into a page filter.

## The concept worth knowing: response freshness

Imagine asking a librarian for two books in quick succession. The first answer arriving last should not replace the second request.

Precisely, asynchronous requests can finish out of order. Search compares the response's query and account context with the current context before displaying it. This also prevents previous-organization results appearing after an account change.

## Watch out for

Some lists expose recent records rather than complete historical search. Company transaction text search filters its table; export retains its own period and fleet filters. Focused tests and TypeScript checks passed, but hosted load, provider behavior and final browser acceptance require their separate evidence. Staff links use membership references rather than putting email addresses in URLs.

## Check yourself

1. Why keep successful sources when another source fails?
<details><summary>Answer</summary>A partial outage should not remove working pages and records. The control keeps them visible and offers retry for the incomplete lookup.</details>

2. What if the account changes while a request is pending?
<details><summary>Answer</summary>The old response fails its context check and cannot populate the new account's suggestions.</details>

3. Why must destination pages read the query parameter?
<details><summary>Answer</summary>Navigation alone would open an unfiltered list. Applying the query makes the selected record findable and preserves shareable browser navigation.</details>

## Explain it back

Without looking at the code, explain in 2-3 sentences what this change does and why it works. If you get stuck, that's the part to reread.

---
*Made with Edirae Learn · edirae.com*
