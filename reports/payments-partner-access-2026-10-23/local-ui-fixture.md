# Isolated UI acceptance environment

23 October 2026. This fixture uses the existing application API and a separate schema in the disposable loopback PostgreSQL instance. All records are synthetic. It does not read the real environment file or call hosted providers.

- API: `http://127.0.0.1:4419`.
- Web URL: `http://127.0.0.1:4310`, with `NEXT_PUBLIC_API_URL` explicitly pointing to the local API.
- The final patched Next.js 15.5.28 production build is served by normal `next start`. Its seven target HTML routes returned 200. The full web suite passed all 485 tests, and the no-emit TypeScript check passed. Logs are preserved under `evidence/frontend-final-patched-*`.
- Synthetic mechanic owner, mechanic viewer, gas-station owner, administrator and company accounts all successfully authenticated with the real local login API.
- Workshop, staff, billing, station, pricing, company station locator, admin station review, admin application intake, refund queue and company card recovery reads returned 200.
- A single synthetic company card issuance row in `review_required` provides an admin form fixture. No card was issued and no provider operation was dispatched.

The initial API probe included `/api/admin/intake`, which returned 404 because that path is not an application endpoint. Reading the existing frontend mapping identified `/api/admin/stations/review` and `/api/admin/intake/applications`; both returned 200. This is not recorded as an application route defect.

The frontend agent's Chrome operations fail while loading the browser request-header policy, and its CUA runtime reports that `iab` is unavailable. The root agent has a distinct working CUA in-app browser session and owns the subsequent visual checks. No shell-controlled browser is used as a fallback.

An initial programmatic development wrapper did not apply its intended separate output directory and collided with an overlapping build, causing local route 500 responses. The development process was stopped; the production build was rerun successfully alone and its output is now served by the standard start command. This was an isolated test setup error. No application source or configuration was changed to resolve it, and `.next-ui23` is absent.

The root agent subsequently completed actual CUA acceptance of workshop owner/viewer, Account navigation, gas profile/POS/pricing, admin review and company locator. The pricing correction passed whole-document width checks at viewport widths 320, 390 and 1440, with no console errors. Screenshots and the exact measured widths are recorded separately in the evidence. These local checks do not prove real provider behavior or production data parity.

After browser acceptance, only the task's web/API processes were stopped and its disposable schema was removed. The final production build remains present; no `.next-ui23` output remains. The fixture URLs above describe the completed test environment and are no longer serving.

Temporary setup scripts, test credentials and environment receipts are kept in `/tmp`; credentials and tokens are excluded from this report.
