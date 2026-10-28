# Admin access and workflow release

28 October 2026. Base revision: `ae84064939e142cf8bbe1ef754f68df187520a69`. User authorized implementation, testing and release to master and attested qualified review. Source/test patch SHA-256: `9be8cf158d9321a7ad4f8de493b65af694c8f10b388943705a3c67622d259a91` (`changes.diff`, stored locally). Release receipt will record the resulting commit and hosting results separately.

## Delivered behavior

| Page or caller | Changes |
| --- | --- |
| `/admin/staff` | Centered creation/edit review includes a required Super Admin, Supervisor or Staff role and explicit page selection. Saved roles/grants are displayed in the records. Only Super Admins with Staff access can manage administrators. |
| Admin navigation, search and APIs | Sidebar, mobile navigation and search use the same page catalog. Unassigned page components do not mount; direct navigation returns to the first assigned page. API requests recheck current database grants, including existing sessions. Unknown routes fail closed. |
| `/admin/operations` | Queued, Active and Closed columns can be minimized, maximized and restored. Customer, partner and company origin filters remain. Review opens in a centered dialog with Escape/backdrop dismissal. |
| Ticket closure | Staff request closure with a reason. A Supervisor or Super Admin with Operations access approves or rejects. Pending tickets stay Active; messages and stale decisions cannot silently close them. Direct close is blocked. Closure decisions and revisions are audited atomically. |
| `/admin/discount-approvals` | Matching board groups queued, approved/scheduled and rejected/expired/superseded requests. Expired requests cannot be approved. Review remains a centered popup. |
| Discount pricing and partner history | Rejecting a request preserves a live approved discount. A future approved replacement starts at its approved time; the current discount continues until its original expiry or replacement start, whichever is earlier. Requested dates remain intact, effective dates are recorded separately, and all price readers honor them. Partner history shows the same effective window and time-dependent status. |
| `/admin/customer-benefits` | Retained because it supports actual funding-history and generator-repair workflows. Added direct task links and specific next steps. Saved itemized quotes reopen with exact labour/parts, partner and scope. Failed/stale queues cannot submit actions. Missing verified mechanics and funding setup are explained. Existing payment/funding gates remain enforced. |

No framework, dependency, CI or unrelated infrastructure changes were added. The complete 52-file application/test/shared-module inventory is in `source-manifest.txt`. One combined learning note is in `../../learn/2026-10-28-admin-access-and-workflows.md`.

## Data and access impact

- Migration **046** deliberately preserves previously unrestricted legacy administrators as Super Admins with all pages once. New admin rows default to Staff with no grants. Staff mutation transactions serialize privilege changes, reject self-lockout and preserve a current Super Admin with Staff access.
- Migration **047** adds ticket revisions and attributable closure requests, a unique pending request, matching ticket/request constraints, private-table permissions and message triggers. The message trigger uses `FOR NO KEY UPDATE` to avoid a reproduced foreign-key lock upgrade deadlock during concurrent replies.
- Migration **048** adds nullable bounded `effective_ends_at`; it never extends the originally requested expiry. Station locks serialize simultaneous reviews. Superseded discounts cannot revive when a replacement ends.
- New shared access metadata is projected into sessions, development seeds and test fixtures. Tokens alone cannot retain a revoked page grant. User organization membership and fuel selling units are unchanged.
- Benefit payment calculations and provider effects were not redesigned. The browser quote used disposable local programme balances only; no production money or customer records were changed for QA.

## Verification

| Check | Fresh evidence and outcome |
| --- | --- |
| Full frontend regressions | **758 passed, 0 failed, 0 skipped**, `evidence/web-final.log`. |
| Production build, types and lint | **Passed**, `evidence/build-final.log`. Existing lint warnings remain; this is not a zero-warning claim. An earlier attempt conflicted with the dev server's generated `.next` output; the dev server was stopped, generated output cleared and the successful build rerun alone. |
| New authorization integration | **16 passed**, including denied page access, revocation, role constraints, self-lockout, last manager and atomic audit behavior. |
| Ticket closure integration | **17 passed**, including roles, stale revisions, closure lifecycle, new messages, concurrency and audit rollback. A separate probe reproduced and then verified the deadlock fix. |
| Discount integration | **12 passed**, including rejection preservation, future boundaries, no expiry extension/revival, concurrent approvals, permission revocation and migration replay. |
| Existing admin integration | **59 passed**, preserving existing provisioning, approval and support assertions in a schema with the actual new migrations. |
| Broader API suite | Initial **1,417 tests: 1,382 passed, 22 failed, 13 skipped**. All 22 observed failures came from outdated admin identities/grants, the new private table inventory or one preexisting static assertion. The seven affected files then passed **78/78**, no skips. The unchanged passing files were not repeated. This is combined evidence, not a claim that the initial full run was green. |
| Optional API smoke tests | **13 not run**: require `SMOKE_BASE_URL` and legacy seeded accounts. They are not counted as passes. Local browser API tests are separate evidence. |
| Final source hygiene | `git diff --check` passed. No environment files, credentials or historic reports are included in the intended release. |

Machine-readable API details and log hashes: `evidence/api-verification.json`. Local providers/test responses were used. This work does not certify payment-provider sandbox settlement, real-funds reconciliation or all production configuration.

## Browser results

Used the actual local web app and API, real password/session login, an isolated PostgreSQL schema and synthetic records. External provider requests were disabled; local delivery was used. Verified:

- Required role and multi-page controls; created a disposable Reports-only Staff account and reopened its saved grants.
- Super Admin approval moved a pending request from Active to Closed.
- Restricted Staff login landed on Operations; mobile navigation showed only Operations and Reports. Direct Staff-page navigation returned to Operations. Staff closure request moved Queued to Active/pending, and its reopened dialog offered withdrawal with no approval action.
- Minimize, maximize and restore worked and preserved other minimized lanes. Escape and clicking outside dismissed record review.
- Discount boards retained pending, active, scheduled, rejected and expired records.
- An itemized repair quote saved exact decimal amounts and reopened with labour, parts, verified mechanic and scope intact. Available programme funds and reserved subsidy updated in the isolated database.
- Desktop and measured CSS widths **390 and 320** were checked. At 320 the administrator form reached Save/Cancel without horizontal overflow. Header geometry was visible and in bounds; the verified native screenshot includes its title and Close button.

Two independent rendered critique rounds caught and corrected inline card fields running together and generic creation copy. Actual scores remain **3–5/5**. Universal 5/5 was **not** achieved or claimed. See `CRITIQUE.md`; these utilitarian workflow changes preserve the established admin design. Some earlier raw browser screenshots had capture-position artifacts; `evidence/ticket-popup-phone-verified.jpg` resolves the ticket-header evidence gap.

## Release and recovery

The user has authorized release after testing. Hosting access was checked before push: the available browser accounts did not own the Obligon projects, so a request to sign into the owner accounts is pending. Public GitHub/Vercel status and API health can be checked independently. Record exact final commit, provider status, API health and any CI restrictions in `release-receipt.md`; do not infer a successful deployment from a push alone.

These migrations add data rather than delete existing user records. **Rolling the API back to the base revision is not authorization-safe after restricted staff accounts exist:** old code ignores page grants and closure approval. Prefer a targeted forward fix retaining the new authorization/closure enforcement. If a full downgrade is unavoidable, an operator must first disable admin access and preserve original account statuses securely, then restore/review access deliberately after repair. Keep closure history and effective discount dates; do not drop migrations as an incident shortcut. This host-level recovery has not been timed or executed in production, and no five-minute rollback guarantee is made.

Production payment/provider requirements from previous reports remain separate. Available API health reported Sudo and maps unavailable and the scheduler disabled; this admin feature release does not resolve or conceal those preexisting launch limitations.
