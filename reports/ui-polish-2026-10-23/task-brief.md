# Obligon UI polish working brief

23 October 2026. Repository `/home/inimfon-udoh/Obligon/checkout`; branch `master`; base `a27caac35d740a2dd4b8c53ea83c948a3163a400`. All task changes remain uncommitted and unreleased.

## Current user outcome

The user has expanded the active payment/RBAC and Google/passkey work twice: first working dynamic search across customer, partner, company and admin dashboards, then a coherent visual improvement of the entire application. Use app-designer and the installed design reference repositories, remove clunky visible scroll indicators while retaining scrolling, and implement/test loading, success, error, empty and other applicable states. Review every page against an explicit five-point rubric with evidence; do not invent perfect scores or equate screenshots with complete production readiness. Push to master and verify deployment after the required qualified human review of the exact consequential patch.

Preserve the existing brand, product decisions, subscriptions in My Card, company contract approval, mechanic/workshop fuel restrictions, approved gas selling units, privacy and accessibility. No redesign-driven financial/authentication behavior changes, paid services or destructive hosted tests.

## Completed increments and evidence

- Payment and partner access: `reports/payments-partner-access-2026-10-23/report.md`; its frozen snapshot has 103 source files.
- Google/passkeys: `reports/google-passkey-2026-10-23/report.md`, frozen 132-file combined source snapshot in `application-snapshot.json`/`.diff`. Full API 1,251 passed, 13 opt-in live checks skipped; no failures. Migrations 001–039 pass plus idempotent rerun; dependency and secret scans have no findings. Web 512 passed, later layout-only correction 66 focused passed, TypeScript and production build passed. Chrome actual login/settings checked at 1440/390/320 and every role. Real Google popup recognizes Obligon; no account selected; physical device enrollment is untested.
- Google Cloud project quota prevented a new project. User explicitly approved existing `feisty-gasket-469408-u4`, Google policy acceptance, client creation and production OAuth audience. Exact JS origins are `https://obligon.vercel.app` and `http://localhost:4310`. Public client ID is in ignored root `.env`; no client secret retained. Production application environment has not been changed.
- Dynamic search is implemented and under final bounded review. Evidence: `reports/dashboard-search-2026-10-23/`. Loader uses existing authorized APIs only; honest recent-record limitations and partial errors. Shared header search supports keyboard, mobile dialog and stale-context suppression. Destination query bridge preserves ordinary manual edits and reapplies selected results. Final whole-web/build/Chrome acceptance remains pending. Last identified correction: admin company results must use canonical `/admin?search=...`, since `/admin/companies` redirects without the query.
- Learn files: `learn/2026-10-23-payments-and-partner-access.md` and `learn/2026-10-23-google-and-passkey-sign-in.md`, indexed. Search and full UI polish need their own task-level breakdowns when finished.

## Team and ownership

- Root: final integration, design direction/shared foundation/global CSS/public/auth UI, actual Chrome acceptance, reports and release. Do not overwrite frozen reports when generating a new combined review snapshot.
- `customer_partner_audit22`: dynamic shared search/header UI complete; now read-only customer/partner UI inventory, awaiting direction before styling.
- `company_admin_audit22`: destination query bridge/search complete; now read-only company/admin UI inventory and final search review, awaiting direction before styling.
- `backend_readiness_audit22`: backend auth/API complete; search loader/review and final canonical admin path correction, then closes to free a slot for an independent design critic.

## Running local acceptance environment

Task-owned PostgreSQL 18: `postgresql://obligon_test@127.0.0.1:55423/obligon_pay_rbac23`. Never load real environment for isolated API tests. HTTP/PG require allowed loopback execution. Default Node test isolation is mandatory.

Disposable browser API fixture script `/tmp/obligon-auth-ui23-fixture.mjs`, exec session `95894`, port 4419. Ready metadata `/tmp/obligon-auth-ui23-fixture-ready.json`; schema `auth_ui_acceptance23_0c07f6412a`. It blocks all external provider fetches, contains synthetic roles, and removes its schema on SIGINT/SIGTERM. Search records seeded by `/tmp/obligon-search-browser-seed23.mjs`; metadata `/tmp/obligon-search-browser-seed23.json`.

Production web server exec session `44774`, localhost:4310, old built source before search. Stop it before rebuilding `.next`. Build with explicit `NEXT_PUBLIC_API_URL=http://127.0.0.1:4419 NODE_ENV=production`; do not run simultaneous build/dev servers on `.next`.

Chrome CUA handles: `obligonGoogleChrome23` browser4; test tab `obligonAuthBrowserTab23` id1673767954, currently synthetic admin on sign-in options. Cloud tab `obligonCloudClientTab23` id1673767949. `obligonAuthCdp23` is the test tab CDP capability, with a390px override. Browser-wide viewport affects the selected Cloud tab rather than necessarily the test tab; use tab-scoped CDP emulation and clear it at cleanup. `obligonShotFs23` is filesystem screenshot writer. After compaction call `cua.rewriteDocumentation()`. All computer/browser interaction stays in CUA. Close only agent-created tabs at the end.

## Release limits

User-supplied AGENTS.md requires qualified human approval of this exact new money/auth/authorization change set before production release. Prior approvals covered old patches or Google Cloud setup, not this combined code. Finish implementation, verification, independent review and a concrete diff/manifest before asking. Persistent blocked checks include Sudo sandbox, full payment provider/bank/books acceptance, hosted recovery/alerts/backups and Nigerian SMS handset receipt. Keep these explicit; do not assert 100% launch readiness.
