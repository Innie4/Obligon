# Partner station-profile controls

Date: 17 October 2026. Scope: `/dashboard/station-profile`, including creation and editing.

## Delivered

1. Replaced latitude/longitude inputs with an explicit **Use my GPS location** action and an adjustable Leaflet map. Operators can click or drag a pin, or pan with the keyboard and confirm the map centre. Coordinates are shown read-only; saving the profile applies them. GPS reports approximate accuracy and distinct denied/unavailable/timeout states. It never runs on page load. Initial map centring is never treated as a station position. Manual placement requires street-level zoom and successfully loaded tiles; retries and failures keep placement disabled until the map becomes usable. GPS remains available if map loading fails.
2. **Fuels available** is a checkbox dropdown with selected-value chips and a count. Multiple choices are supported. Existing fuel names and unchanged order are preserved because other station records use exact fuel strings as pricing keys. Published prices and discounts are not rewritten.
3. **Opening hours** provides Not set, Open 24 hours, and Daily hours choices. Daily hours use native time pickers, readable AM/PM summaries and explicit next-day closing for overnight schedules. Phone controls stack to keep AM/PM visible. Unknown legacy schedules remain unchanged until deliberately replaced. These are displayed hours; they do not automate the separate station open/closed flag.
4. **State / FCT** controls the **City / town** dropdown. Search filters its options without silently discarding a selected city. A new State clears the old city. All 37 State/FCT entries are supported, using 52,320 mapped GeoNames place names rather than relabelled LGAs.

## Persistence and compatibility

The existing API contract is retained: normal POST creation and PUT updates, bounded readable city/hours text, fuel arrays and numeric coordinate pairs. State and city persist as a combined label such as `Uyo, Akwa Ibom` in the existing city field. Unchanged recorded city text is preserved. Ambiguous or unmatched legacy locations are shown explicitly; their State is not guessed.

The editor is keyed by station. Fetched data must match the selected ID before editing, and saves disable station selection. Old GPS callbacks cannot populate another station. Adding a first station remains possible after a failed profile read. Existing organization permissions, subscription checks and admin review remain enforced. No API, database, payment or authentication implementation changed.

The city catalog and map editor load separately from unrelated dashboard screens. Leaflet 1.9.4 and its TypeScript declarations are pinned; its BSD 2-Clause license is retained in public third-party files. GeoNames attribution is visible in the form and detailed provenance/download hashes accompany the catalog.

## Verification

- Full web suite: **383 passed, 0 failed, 0 skipped** (`node --test --experimental-test-isolation=none tests/*.test.cjs`). This includes 75 new catalog, field, GPS and form/integration cases.
- Independent review: no remaining concrete findings. Fresh independent GPS/form/field checks: 66 passed.
- Production build: passed, including TypeScript validation. Existing unused-symbol warnings elsewhere/in the shared dashboard file and the outer/checkout lockfile warning remain. New components/helpers passed focused lint without errors.
- Production dependency audit: `pnpm audit --prod --json` reported 0 advisories across 279 production/optional dependencies. This is a dependency result, not an application security assessment.
- Chrome browser: inspected 320px and 390px phone layouts and 1440px desktop. No horizontal overflow; the narrow fuel popup stayed within the form, time pickers showed AM/PM, and GPS/map controls had usable touch targets.
- Exercised State→city reset, Uyo search/selection, three selected fuel values, Escape dismissal/focus restoration, native-keyboard overnight time editing, keyboard map adjustment and a local-only save preserving full coordinate precision.
- Blank new-station submission showed field errors and never saved an initial map centre. No numeric coordinate inputs remain.
- The temporary isolated preview route was removed before the production build. No live station records or device GPS location were used in those tests.

## Limits and sources

GeoNames is a sourced gazetteer of cities, towns, villages and populated localities, **not an exhaustive official city register**. 310 current populated-place records without reliable State mappings were excluded; 78 abandoned/destroyed records were excluded. The catalog has a documented 17 October 2026 snapshot and is not a live reverse-geocoder. Choosing a city does not establish that a GPS point lies inside its administrative boundary; operators and existing admin review must confirm the station.

Real-device GPS permission/accuracy and screen-reader sessions were not tested. GPS behavior was verified with synthetic success, permission denial, unavailable, timeout, malformed-result and stale-response tests. Map tiles are supplied by OpenStreetMap and can be unavailable; error/retry behavior is implemented.

Primary references: [Leaflet reference](https://leafletjs.com/reference), [Leaflet license](https://github.com/Leaflet/Leaflet/blob/v1.9.4/LICENSE), [OSM tile policy](https://operations.osmfoundation.org/policies/tiles/), [browser Geolocation](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/getCurrentPosition), [GeoNames download documentation](https://download.geonames.org/export/dump/readme.txt), [GeoNames feature definitions](https://www.geonames.org/export/codes.html). UI work followed the ten-source UI Reference Guide, the existing Obligon brand, and local accessibility guidance; no hosted design service was used.

## Recovery

Revert the frontend commit to restore the former editor. No migration or account-access change needs reversal. The active partner test account's fixed expiry is unchanged. Deployment/live verification is recorded separately after push.
