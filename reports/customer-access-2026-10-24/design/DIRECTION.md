# Obligon customer access and preferences

2026-10-24, Africa/Lagos. Self-authored brief assembled from the user's request and existing product.

## Brief

Obligon is a Nigerian fuel-card product for customers finding registered stations, managing fuel spending and paying for fuel. The immediate action is to choose a paid plan when access is inactive, or find the nearest eligible station when access is active. The new flows should feel clear, grounded and familiar. Preserve the existing green brand, logo, Plus Jakarta Sans headings, Inter UI text, React/Next application, proven dialogs and responsive navigation. This is a scoped web implementation, not a new iOS app, logo, name, app icon or navigation system. No image generation, paid service, font download or added UI dependency is needed.

The user's clarified access rule is strict: without a currently paid active plan, only plan purchase, card verification and sign-out are exposed in the customer dashboard. Confirmed plan payment unlocks the dashboard; card use remains separately blocked until identity/card approval. Profile, theme, station discovery and support do not bypass the subscription gate.

## Current app

Inspected `apps/web/components/customer-dashboard/CustomerScreen.tsx`, `CustomerShell.tsx`, `apps/web/tailwind.config.js`, public brand assets and the preceding card-identity design artifacts.

The station page currently exposes a bordered inline location request, a repeated Use my location action, and latitude/longitude manual fields. It starts location watching after browser permission is already granted. The sidebar exposes Sign-in options separately from Profile & Settings. Profile has personal data and notification preferences, but no working theme choice. Some operational capabilities have feature checks; the requested all-dashboard paid access gate is broader.

`before.html` is a source-grounded reconstruction of the old location block, not a live application screenshot. No unobserved screenshot defect or scanner FAIL is claimed. The relevant design smell is hierarchy fragmentation: the permission explanation, button and manual fallback compete with the station search. This is not a claim that the app matches every named slop pattern.

### Keep, lose and unknown

- [x] Keep name, brand mark, green actions, current font families, customer tab structure and existing profile fields.
- [x] Keep station search, fuel filters, opening-hours filters, station details and directions.
- [x] Keep accurate straight-line distance language instead of implying travel distance.
- [x] Keep explicit location choice and a way to browse without location.
- [x] Keep password/Google/passkey management, reached from Profile & Settings for subscribers.
- [x] Keep plan purchase and identity/card verification reachable while dashboard operations are locked.
- [x] Keep all provider/payment errors truthful and use established popup feedback.
- [x] Lose the repeated automatic permission solicitation, inline latitude/longitude fields and standalone sidebar Sign-in options link.
- [x] Lose any suggestion that card approval is required to unlock an already paid dashboard.
- Unknown: actual handset GPS accuracy, OS/browser permission behavior and payment-provider completion. These require application/device checks.

No tab, product name or hero metric is changed. No additional product decision is needed for this scoped implementation. New-account detection and whether existing users are grandfathered are implementation rules to verify against the approved API contract; a universal new popup must not be inferred from missing client storage alone.

## Research and references

Read all ten installed UI-reference catalog summaries. Selected: Superdesign's distinct-direction exploration, Better Design's semantic-token discipline, Design Taste's corporate-trust clarity and accessible settings structure, UI Layouts' responsive composition, and Motion Primitives' focused-dialog/change-of-state ideas. Inspected corporate-trust and morphing-dialog source locally. No copied code or new library is introduced. Canvas UI, Paper Shaders, Hyperiux, Cursify and Trickle are consciously omitted: GPU effects, custom pointers and animated headings do not improve permission, subscription or settings decisions. Hosted design reviews were not run.

Current official-source research on 2026-10-24:

- [Apple Maps nearby search](https://support.apple.com/guide/iphone/find-nearby-attractions-restaurants-services-iphbaf51b2c0/ios): search and categories are explicit controls; nearby discovery is separate from a list item's details. The page includes an official interface image, but pixel-level inspection of the image was not completed.
- [Shell station locator](https://www.shell.co.za/motorists/shell-station-locator.html): geographic discovery and route planning are the core actions. The global Shell URL could not be fetched, so this official regional source was used as limited text research.
- [GasBuddy station filters](https://help.gasbuddy.com/hc/en-us/articles/27607073832727-Finding-Stations-with-Air-Vac): list/map discovery and amenities filters remain user-operated. The marketing app page returned 403, so no competing-app screenshot finding is claimed.

This is limited official text research, not a comprehensive visual competitor study. Inferred category defaults are a dominant map, a list of station cards and location as a persistent toolbar action. We retain a meaningful search/list relationship but refuse a large decorative map as the permission prompt, or a claim that location has been verified. Existing green is a user-established brand, not an automatic fintech palette choice.

Outside-app sources are an arrival sign at a forecourt (place), a car's night instrument panel (object), and a regional traffic broadcast's route panel (media). Their physical roles inform emphasis and grouping; no external imagery or copyrighted visual asset is copied.

## Three concepts and choice

`explore.html` contains the same permission decision in three complete source layouts:

| Direction | Concept sentence | Source | Ground | Type | Accent | Richness |
| --- | --- | --- | --- | --- | --- | --- |
| Arrival sign | Obligon is an arrival sign that points you toward the next station. | place | light | grotesque | green | illustration |
| Night instrument | Obligon is a car instrument panel that shows only the next useful action. | object | dark | mono | orange | colour-material |
| Route broadcast | Obligon is a regional route broadcast that makes the next turn clear. | media | colour-field | serif | yellow | shape |

Arrival sign is the provisional implementation direction: the actual station/location purpose earns a compact route-and-station illustration, and the existing white/green brand remains immediately recognizable. Night instrument's mono density is less comfortable for long forms and duplicates a car cockpit without adding vehicle data. Route broadcast's saturated ground and serif introduce a competing identity and reduce continuity with existing dashboards.

**Rendering limitation:** the provided `shoot.mjs` preflight exits 2 because `playwright-core` is not installed in project or skill. No package was installed. CUA rejected a `file:` preview because browser URL policy permits only HTTP/HTTPS and explicitly disallows workarounds. The blocked document was not re-served over HTTP or accessed with alternate raw browser methods. These concept layouts are therefore provisional source designs, not rendered verified directions. Parent implementation can be assessed through normal application HTTP testing, which is a different deliverable from the blocked static-file preview.

## Tokens and composition

Light: ground #f6f8fa, surface #ffffff, raised #f2f5ef, ink #00010c, secondary #454650, line #dde3e8, primary #3d6a00, primary label #ffffff. Dark: ground #11181e, surface #192229, raised #26322c, ink #f3f6f7, secondary #b8c3cb, line #3b4850, primary #b7d693, primary label #17220f. Green denotes action/selection. Success and errors use existing semantic popup roles, never decorative colors.

Actual available local font files are `apps/web/app/fonts/Inter-variable.woff2` and `PlusJakartaSans-variable.woff2`; use Inter intentionally for continuity and readable form labels, Jakarta for existing heading identity. This host is Linux; Apple fonts are not verified or required for the web implementation. Device-kit tokens are reference scaffolding only, not a claim of native iOS fidelity.

Type scale 11/12/13/14/16/26/32/34 px, body weights 400/600 and heading 700, heading tracking -0.7 px, tabular station distances. 11 px is restricted to secondary metadata and navigation. Main controls are at least 44 px. Side spacing 20 px on phone, 24 px inside dialogs, 32 px on desktop; gap scale 4/8/12/16/24/32. Radius 12 px controls, 16 px sections, 22 px modal. Do not nest extra cards inside settings sections. Dark mode changes roles rather than applying a brightness filter.

## Exact content and flow

### Subscription required

Title: **Choose a plan to continue**. Body: **Subscribe to unlock your customer dashboard. Access starts when your plan payment is confirmed.** Primary: **Choose a plan**. Card note: **Your card is a separate step. Complete card verification after choosing your plan. Card use stays locked until approval.** Conditional verification action: **Verify card details**. Final action: **Sign out**. No operational navigation, profile, theme or account-security bypass links appear on this gate. Preserve checkout return/reconciliation so a provider timeout never falsely unlocks access or blocks a legitimate retry.

### First station visit for an eligible new account

Title: **Find stations near you**. Body: **Use your location to show the nearest registered Obligon stations first. You can still search and filter the list.** Primary: **Use my location**. Secondary: **Browse without location**. Privacy explanation: **Your location is used to sort stations. You can turn it off at any time.** It must not say coordinates stay in the browser: coordinates are sent to the Obligon station-query API for distance calculation. No precise coordinates are persisted on the account.

Record the account's one-time choice before or together with requesting browser permission. A new visit, reload, different browser or denied permission must not re-open the welcome prompt. Browser denial is not permission to keep retrying. Manual controls can request location again. Watch location only when enabled; stop on disable/unmount. Filters continue to apply to the distance-sorted registered/approved stations.

### Active station list

Page title **Find a station**; intro **Search locations, view fuel prices and get directions.** Search **Search station or area**; controls **Fuel type**, **Open now**, **More filters**. Status **Nearest stations first** with **Straight-line distance from your current location.** Manual location control **Location**. Station names/distances in mockups are explicitly illustrative, not production station inventory.

Pending popup **Finding your location…**. Error title **Location unavailable**; message **Check your browser settings or browse all registered stations. You can try again from Profile & Settings.** Actions **Browse stations** and **Try again**. No-results popup must explain active filters and expose a clear reset action. Permission unavailable, permission denied and GPS timeout must never imply successful location detection.

### Profile & Settings

Heading **Profile & Settings**. Section **Appearance**; description **Choose how your customer dashboard looks.** Radio choices **Light** and **Dark**, each with a preview and visible checked indicator. Persist account choice and restore it before paint. Avoid changing another role's theme merely because a customer used this browser.

Section **Sign-in options**; description **Manage your password, Google account and passkeys.** Action **Manage sign-in options**. The shared authentication route must preserve the customer context/return path and its established authentication checks.

Section **Station location**; description **Show the nearest registered stations first.** Enabled control must offer **Turn off location**, disabled control **Use my location**. Use the same privacy line as the prompt. Immediate preference saves use the app's established success/failure popup and recover from network errors; do not claim persistence before acknowledgement.

## Signature and accessibility

The remembered interaction is the location choice becoming an ordered station list: prompt explains why, primary requests permission, pending popup tells the truth, nearest-first label and distances appear only after a current valid fix. A route line in the prompt is restrained context, not an animated simulated GPS result. If motion is used, a single 160 ms state cross-fade is enough; reduced motion removes it. No web haptics or automatic map panning.

Dialog: focus enters title/first action, keyboard remains in it, both choices reachable, Escape follows the non-location choice, return focus to the trigger. Do not consume the welcome prompt while still behind a subscription gate. Theme uses a named radio group and communicates selection independently of color. All API errors use existing popups, preserved inputs and retry where safe. Dark fields, menus, dialogs, calendars, station rows, charts, map chrome and focus states must be audited in the actual application; the static settings mockup alone does not establish dark-mode coverage.

## Review evidence and limits

`before-after.html`, `mockup.html`, six individual state pages, three individual concept pages, and `desktop.html` are prepared. `CRITIQUE.md` records two source-review rounds without inventing pixel scores. `verification.json` records deterministic contrast/source checks. No rendered PNG, clean slop scan, independent pixel critique, real-device feel or 5/5 claim is made. Application screenshots and actual keyboard/runtime checks remain the root implementation's evidence.

Shared history was read. The current existing web look counts as object/light/grotesque/green/colour-material; Arrival sign changes source and richness but intentionally preserves brand, type and light ground because user-brand continuity overrides the skill's unrelated full-rebrand history rule. The global history file is outside permitted write roots; pending row is saved here, not silently appended.

Pending history row: `| 2026-10-24 | Obligon customer access | place | light | grotesque | green | illustration |`.
