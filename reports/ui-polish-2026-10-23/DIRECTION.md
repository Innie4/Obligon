# Obligon interface direction

23 October 2026. This is an implementation brief for the existing web application, applying the requested app-designer process to responsive web screens.

## Three explored directions

1. **Clear workspace**: white navigation, cool light canvas, green selected rows, Jakarta headings and Inter controls. The working content leads. Chosen because people need to distinguish account context, transaction status and their next action quickly.
2. **Night operations**: navy ground, white type and lime actions, with more prominent financial totals. Rejected for long operational tables and forms; the existing public hero already supplies this brand moment.
3. **Field journal**: pale green ground, serif section titles and dark ruled records. Rejected because it introduces a third face and weakens continuity with the shipped product.

Rendered exploration: `evidence/directions.jpg`. The first direction is the shared dashboard contract. Public pages retain larger navy fields and existing FuelVista card imagery; form pages use the same clear controls and feedback patterns.

## Keep

- Existing green, navy, blue and lime brand roles, logos and bundled fonts.
- All customer, partner, workshop, company and admin routes and authorization boundaries.
- Existing plans, company approval rules, station units and payment confirmations.
- Dynamic scoped search and its loading, partial-error and empty-result behavior.
- Keyboard focus, reduced motion, responsive navigation and usable scrolling.

## Tokens and components

- Canvas `#f6f8fa`; surface white; primary text `#111827`; secondary text `#454650`; quiet borders `#dde3e8`.
- Green `#3d6a00` for the primary action and selected navigation; light green `#edf4e7` for selection backgrounds. Navy and blue remain brand fields. Red and amber communicate failures and warnings, always with text.
- Bundled Plus Jakarta Sans for headings, because it is the established brand face. Bundled Inter for dense forms and financial records, with tabular figures on data.
- Controls 44px on mobile, body copy 14–16px, secondary labels at least 12px. Page breaks larger than group spacing. Panels use subtle borders; floating dialogs/menus alone need substantial shadows.
- Scrollbars hidden visually without changing overflow behavior. Tables retain named, keyboard-focusable scrolling regions.
- Search selection and state feedback provide the signature interaction: a scoped result takes the user to the relevant record and restores its visible filter.

## References and restraint

The UI reference guide's ten-source catalog informed selection. Local Motion Primitives button/dialog and Canvas UI accordion sources informed focus, disabled and reduced-motion states. Their dependencies were not copied into the app. Better Design and UI Layouts informed alignment and hierarchy. React Bits, React Bits Pro, Paper Shaders, Hyperiux, Cursify and Trickle were assessed for motion/effects; operational workflows do not need GPU effects, custom cursors or animated text. No paid generation, hosted account or new UI dependency was introduced.

The rejected category default is a glowing dark finance dashboard with competing statistic tiles and tiny uppercase labels. This direction keeps useful financial data but uses readable forms, restrained selection and fewer nested containers. Native iOS typography, physical biometrics and native-device interaction are outside the evidence from this web build.

## Quality gate

Each route must be inventoried, affected shared components verified and applicable asynchronous states checked. Review desktop and phone renders of each unique page family, with narrow-width overflow and keyboard checks. The independent critic scores actual screenshots. A requested 5/5 is a target, not a result to assign without evidence. Record blocked and unobserved states explicitly. At most four critique rounds; fix concrete functional or accessibility defects regardless of aesthetic scores.
