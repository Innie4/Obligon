# Customer state checks on the production build

24 October 2026. Isolated Chrome at 390 × 900 against the local production build on port 4310. Only the synthetic Bronze customer was used. No application source changed.

## Checked

- Selected Dark through the existing profile radio control. The preference PATCH succeeded, the page reloaded, and the saved Dark selection and body theme were retained.
- Reviewed and captured dark Overview, My Card and Profile. The account has an active Bronze subscription and no issued card, which is the intended fixture state.
- Ran axe WCAG A/AA checks on all three dark pages: **0 violations and 0 incomplete checks**. Overview had 24 passing rules, My Card 29 and Profile 26.
- Activated the Security profile anchor using Enter. The target received focus, `:focus-visible` matched, and its computed outline was solid and 2px wide.
- Submitted the profile form with its required Full Name field empty. Browser validation focused the field and exposed its required-field message. No profile write was sent; the local field value was restored without submitting.
- Searched for an unmatched station. Search and fuel-filter controls remained available, the empty result offered Clear filters, and clearing restored the station and empty search value.
- Captured the station map after scrolling it into the visible viewport, using the known WebGL full-page capture workaround.
- Held a read-only notifications GET to capture the loading popup with `role="status"`.
- Injected a read-only notifications GET failure to capture the error popup with `role="alert"`. Its "Try again" button then reloaded the real local data successfully and removed the alert.
- No browser page errors occurred.

## Evidence and QA corrections

Consolidated results: `evidence/states/customer-states-final.json`.

Screenshots are under `evidence/states/`, including dark pages, keyboard focus, required-field feedback, empty station search, the visible map, loading/error popups and successful retry recovery.

Raw first-run output remains in `customer-states.json`. That run had two QA harness assumptions to correct: it expected "Retry" rather than the actual "Try again" label, and its strict write guard blocked the cookie-consent recording POST after "Essential Only" was selected. The application error popup itself rendered correctly. The targeted `customer-popup-retry.json` check confirmed actual retry recovery without an account or payment mutation.

The write guard allowed login and the requested synthetic theme preference change. It prevented other account writes and external sensitive-provider actions. OSM assets were allowed as read-only map requests.

## Not checked by this bounded pass

- Issued Gold-card states, which the root agent covers separately.
- Real customer accounts, physical mobile devices, screen reader output or complete keyboard traversal.
- Payment, BVN, email/SMS delivery and physical passkey provider actions.
- A separately frozen screenshot of the transient appearance-saving popup.

These are focused production-build checks, not proof that every application page or external provider is ready.
