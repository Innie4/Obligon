# Choose station details without typing coordinates

> 2026-10-17 · Improve GPS, available fuels, opening hours, and State/city selection in the partner station profile.

## In short
The station editor now captures a GPS position or an adjusted map pin, offers multiple fuel choices, and presents clear daily or 24-hour opening controls. State-dependent city dropdowns use a sourced place-name catalog rather than confusing cities with LGAs.

## What changed
- `apps/web/components/dashboard/DashboardScreen.tsx`: loads the editor only where needed, keeps selected-station saves attached to that station, and permits creation after a failed profile read.
- `apps/web/components/dashboard/StationProfileForm.tsx`: owns a separate draft, validation, dependent dropdowns and existing-record preservation.
- `apps/web/components/dashboard/StationProfileFields.tsx` and `apps/web/lib/station-profile-fields.ts`: implement fuel choices and opening-hours controls without renaming recorded fuels or guessing legacy schedules.
- `apps/web/components/dashboard/StationLocationPicker.tsx`: acquires GPS on request and supports accessible Leaflet map placement.
- `apps/web/lib/station-profile.ts`: builds and validates the existing station API payload.
- `packages/shared/nigeria-cities.mjs`, its declaration and provenance file: provide 52,320 mapped place names and strict State/city validation.
- Four new tests and two updated dashboard fixtures cover the integration. The manifest and lockfile pin Leaflet/types; `apps/web/public/third-party/leaflet-LICENSE.txt` retains its license.

## How it works
1. Loading a station creates a keyed draft. Switching stations destroys that draft and cancels pending location work.
2. Choosing a State clears the city. Search narrows that State’s dropdown; selecting a city produces a combined city/state label in the existing API field.
3. Fuel checkboxes preserve exact stored names and order. Hours become an existing readable format; unfamiliar saved text stays intact until explicitly replaced.
4. GPS returns coordinates and an accuracy estimate. The map allows precise placement after street-level tiles load. Neither action saves automatically.
5. Save validates the draft and sends the normal create/update request. Selection and editing remain disabled during that request.

## Why it's built this way
The API already stores coordinates, a fuel array and readable city/hours text. Reusing those contracts avoids a database migration and preserves existing consumers. Loading the catalog only with the editor avoids slowing unrelated screens. A GPS result is treated as a candidate the operator should inspect, because device accuracy varies.

## The concept worth knowing: draft isolation
**Simply put:** give each station its own clipboard, and discard that clipboard when switching stations.

**More precisely:** React keys remount the editor when its station changes. The page also checks that fetched data matches the requested station, while the GPS component invalidates late callbacks. An old request cannot silently populate a new station’s draft.

## Watch out for
- GeoNames includes towns and populated localities; its coverage is not an exhaustive official city registry. Unmapped records were excluded, with provenance recorded.
- GPS hardware/permission behavior was simulated in tests. Real-device permission and accuracy were not tested.
- OpenStreetMap tile availability is external; failures disable manual placement while GPS remains usable. Location changes still require existing admin approval.
- Displayed hours do not automate the separate station open/closed status.

## Check yourself
1. Why keep a stored fuel’s exact spelling?
   <details><summary>Answer</summary>Other station records use those strings as pricing keys. A visual control should not silently rename them.</details>

2. Why not save the map’s initial centre?
   <details><summary>Answer</summary>A map needs a starting view, but that view is not evidence of the station’s position.</details>

3. What if a GPS callback arrives after switching stations?
   <details><summary>Answer</summary>The old component is unmounted and its request is invalidated, so the callback cannot update the new draft.</details>

## Explain it back
Without looking at the code, explain in 2-3 sentences what this change does and why it works. If you get stuck, that's the part to reread.

*Made with Edirae Learn · edirae.com*
