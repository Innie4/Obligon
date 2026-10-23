# Obligon interface improvements and verification

23 October 2026. Base: `a27caac35d740a2dd4b8c53ea83c948a3163a400`. Implementation remains uncommitted, unpushed and undeployed pending qualified human approval of the exact combined consequential patch.

## Result

The public pages, account flows and all dashboard families now share quieter surfaces, clearer hierarchy, readable controls and consistent feedback. Visible scrollbars are hidden while scrolling, focus and table access remain available. Dynamic header search opens permitted pages and real filtered records. Existing company approval, partner subtype, subscription and financial rules are preserved.

The requested 5/5 on every page is a target, not an achieved certification. The independent critic's final evidence and scores are in [CRITIQUE.md](CRITIQUE.md) and [rubric.json](rubric.json). Unobserved states remain unscored. The project cannot honestly be described as fully launch-ready while the external acceptance requirements below remain outstanding.

The four-round visual review closed all observed P1/P2 correction items in its inspected scope. Most shown views received provisional hierarchy/readability scores of 4/5. One P3 density observation remains: Admin Requests and Activity uses six rows of category controls at 320px before the selected queue. Labels remain visible and the control works; a more compact selector is an optional follow-up. Intake's provisional hierarchy score remains 3/5. Complete route scores remain null where state/accessibility evidence is missing.

## Changes by area

| Area | Completed work |
| --- | --- |
| Shared foundation | Brand-preserving color/type/spacing treatment; quieter borders and shadows; visible keyboard focus; mobile form text avoids small-input zoom; 44px primary controls; reduced-motion support; hidden scrollbar styling with overflow retained. |
| Shared feedback | Loading, empty, error and stale-data warnings; explicit retry; consistent dialogs; accessible close controls; toasts sit above bottom navigation. Network failures give a useful connection message without retrying writes or clearing sessions. |
| Public pages | Header/menu/logo alignment, clear mobile login/signup buttons, Escape dismissal/focus return, simpler hero/feature layouts, preserved plan grouping and CTA decisions, concrete EnergyVista/GenVista enquiry inputs. Support puts its form before optional information on phones. |
| Account pages | Consistent labels/forms/status shells; truthful anonymous success state; spaced session-expiry recovery links. MFA setup does not tell users to scan a missing QR, and blocked challenge controls look disabled. Google/passkey method states and existing authentication decisions remain intact. |
| Customer | Overview task title and real Wallet/My Card actions; useful station list before optional map; bounded map loading/failure/retry and full-map link; compact inactive-plan support; thread and plan modal states; readable financial history and receipts; Notifications heading in empty states; Account dismissal/focus return. |
| Gas/fuel partner | Clearer profile, pricing, API-key, discount, support, billing and POS controls; compact unit-aware reports; aligned table headers including Staff Access; nonbreaking money and horizontal-scroll guidance; settlement copy reflects the recorded account setup. |
| Mechanic/workshop | Profile/team/support overview, relevant mobile navigation and account functions, accurate workshop/contact wording. Fuel operations remain restricted. Booking and service payments are outside the approved workshop scope. |
| Company | Clear workspace context; compact summaries; labelled phone records; named desktop table regions; explicit driver/vehicle assignment labels; nonbreaking approved units; content-sized settings status panel; readable forms, navigation, support and billing states. |
| Admin | Clear page/record context; labelled mobile records; named keyboard-scroll tables; readable approval/intake/operations/recovery views; bank queue loading/error/empty states; review reason tied to a loaded pending request; muted disabled pagination. |
| Search | One shared desktop/mobile control across four dashboard families; authorized recent-record lookup, debounce, stale-response protection, partial-error/retry/empty feedback and visible destination filters. See the [search report](../dashboard-search-2026-10-23/report.md). |

[page-by-page.md](page-by-page.md) lists all 75 application routes and two system states, distinguishing shared styling, page changes and verification limits. Previous payment/partner and Google/passkey work is documented separately and included in the combined release review.

## Design process

The chosen direction is **Clear workspace**: the established white/green/navy brand, bundled Jakarta headings and Inter controls, a cool light canvas and restrained selection. Night operations and Field journal were rendered and rejected for dense operational use and brand continuity. The exploration is `directions.html` with `evidence/directions.jpg`; decisions and keep-list are in [DIRECTION.md](DIRECTION.md).

The installed ten-source UI catalog informed selection. Local Motion Primitives dialog/feedback patterns and Canvas UI progressive-fallback examples were inspected; their libraries were not added. Better Design and Superdesign local guidance informed tokens and review. Cursor trails, GPU decoration, new type families and unrelated framework changes were not selected. No paid hosted design service or claimed hosted review was used.

The requested app-designer process was adapted to the existing responsive web product. It is not a native SwiftUI/iOS deliverable or an Apple-font/device certification. The brief was inferred from the supplied product, brand and user instructions. Public style lint has no FAILs; the Get started warning follows the user's requested label, and the two h-screen matches refer to minimum-height layouts. See `public-style-lint-final.json`.

## Verification and scope

The current source identity, final test/build results and source-secret scan are in [evidence/final-verification.json](evidence/final-verification.json). Raw web logs are preserved alongside it. API evidence is reused only after checking the frozen backend/shared/dependency file hashes; those inputs remain unchanged.

Final dashboard browser evidence contains 216 role-qualified frames across 1440, 768, 390 and 320 CSS-pixel widths, with no detected page-level horizontal overflow. Revised public/auth pages have 16 additional final captures, for 232 final frames. Public/auth screenshots for unchanged sources remain usable. Historical unqualified `dashboard-*` images were overwritten during earlier role switching and are explicitly excluded from final gas coverage.

Actual Chrome interactions covered record search selection/destination filters for all four dashboard families; customer receipt amount and CNG unit; company calendar keyboard selection followed by cancellation; Account/menu Escape and focus return; keyboard scrolling of hidden-scrollbar tables; local sign-out; workshop restricted destinations; admin connection failure and successful Refresh recovery. No production financial effects or account-method changes were performed.

Representative active company text/button contrast measured 6.44:1 through 20.8:1. This is a sample, not an all-element contrast audit. Browser zoom shortcuts did not demonstrate changed reflow under device emulation, so actual 200% browser zoom remains unverified. Narrow-width checks are recorded independently. No screen-reader or physical-device certification is claimed.

Independent source review found and resolved the Other partner noun mismatch. Map callbacks/timers/cleanup, table alignment, financial presentation and preserved actions were reviewed with focused tests. The final public layout changes also received a separate read-only form/call-contract review. See [independent-review.md](independent-review.md), [round4-layout-independent-review.md](round4-layout-independent-review.md) and their receipts.

## States implemented and limits

Shared boundaries render initial loading, ready, empty, failed load, retry and stale refresh feedback. Search adds no-results, partial failure and cancelled/stale request protection. Plan/support/API-key/discount/approval queues have explicit states instead of blank content or a failed request disguised as an empty list. Forms retain validation, submitting, error and success behavior; account success claims require session evidence. Map readiness distinguishes Google tile events from an unverified cross-origin iframe load.

Deterministic UI and API tests exercise these decisions. Screenshots mostly show populated or empty disposable fixtures and anonymous/guarded auth states. They do not prove every route's paid-plan/card-issued variant, provider payment outcome, submission success, device behavior or assistive-technology announcement. Those gaps are preserved in the rubric instead of assigning unsupported perfect scores.

## Release requirements still open

1. Qualified human approval of the exact combined payment/authentication/authorization patch before production release, as required by AGENTS.md. See the [combined release report](../release-review-2026-10-23/report.md), source manifest and full diff.
2. Sudo sandbox credentials and issuer acceptance; full payment/refund/payout sandbox and provider/bank/books reconciliation; hosted failure/recovery acceptance.
3. Dependable hosted reconciliation scheduling, abnormal-transaction alerts, monitoring and backup restoration evidence.
4. Actual Google-account linking/login and physical passkey/fingerprint/face/PIN/synced-key acceptance on supported devices; hosted Google/RP configuration after approval.
5. Nigerian SMS handset receipt remains unconfirmed. Email and either-contact verification behavior do not establish SMS delivery.
6. Broader independent security/API/load/device/accessibility acceptance and applicable qualified payment/card/regulatory review.
7. Exact Vercel/Render revision, migration logs, health and smoke checks after approved push/deploy. Current production does not contain this uncommitted patch.

These are material limits on a launch-readiness claim. Passing local tests and visual review does not remove them.
