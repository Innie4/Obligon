# Customer access design review

This is a two-round **source review**, not a rendered pixel critique or an independent review. The provided renderer failed before producing an image, and the browser policy rejected the static file preview with an explicit no-workaround instruction. No pixel-level rubric score, scan pass or 5/5 rating is invented. The source layouts are provisional until the actual implemented application is rendered and checked.

## Round 1

Inspected the complete HTML, CSS, content, desktop layout, before reconstruction and flow contract.

1. Privacy text originally said coordinates stay in the browser. That contradicted server-side distance sorting. Replaced with "Your location is used to sort stations. You can turn it off at any time."
2. Initial gate wording could imply identity approval was needed for dashboard access. Clarified confirmed plan payment unlocks the dashboard, while card approval is separate.
3. An earlier proposed wall permitted profile/support recovery links. The user's clarified strict scope permits only plan purchase, card verification and sign-out; removed those bypasses from the design contract.
4. New-account prompt must not run on every missing local-storage value. Added explicit server/account one-time decision and no repeated browser-denial prompt.
5. Settings require an actual radio state and dark-specific semantic roles. Both are present in source; added request to verify all shared dialogs/calendars in actual implementation.

The five source defects/ambiguities above were resolved before Round 2. No application behavior is proved by those corrections.

## Round 2

Rechecked content and markup after those changes.

- The wall copy now names payment confirmation as the dashboard unlock condition and card approval as a separate step.
- No profile, security or support bypass exists in the gate source.
- Location privacy text reflects API query transmission, with no claim that GPS is residence verification.
- Light/dark choices have explicit radio semantics and a non-color checked indicator.
- Source-defined text/label contrast has a deterministic check. This cannot prove rendered contrast on images, antialiasing, inherited application styles or focus states.

Remaining limits: rendering, clipping/collision scanning, keyboard/focus interaction, phone-size real layout, route behavior, runtime errors, live account persistence, permission-denial behavior and actual theme-wide coverage require the parent application's tests. No asset download, dependency installation, hosted generation or workaround for browser policy was attempted.

**Stop condition:** source contract is ready for implementation review; the skill's rendered 12-line stop rule is not met because pixel evidence is unavailable. This is reported as incomplete design-fidelity verification, not as a passing design score.
