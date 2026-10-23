# Dashboard search direction

2026-10-23. Existing Obligon web dashboards, for customers, partners, company teams and administrators.

The task is to make search find permitted pages and recent records, then open the selected destination. The existing green and navy palette, logos, fonts and navigation remain in use. Source inspection found navigation-only desktop search in the partner, company and admin headers, and no shared customer search. Mobile search was absent from those controls.

The shared control uses the existing border, surface, text and green focus tokens. On desktop, it is a 44px search field with a compact list below it. On a phone, a 44px search button opens a labelled dialog with its input and results in one column. Long labels wrap, the results scroll, and every result has a clear destination arrow. The dialog uses the existing focus trap and renders above the dashboard header through a portal.

Copy is direct: “Search pages and recent records”, “Searching records...”, “Retry search”, and “No matching pages or records. Try another name or reference.” A partial lookup failure states that some records could not be searched and keeps available results visible. The UI never substitutes demonstration records for a failed request.

The user's app-designer request is applied to this existing web increment through its layout, touch, copy and state principles. Its native iPhone concept exploration, device chrome and Apple-font mockups do not fit the requested web header change. The ten-source UI reference catalog was reviewed. The selected local references were app-designer's layout and copy guidance, Design Taste accessibility guidance, and the existing project's component conventions. No hosted design generation or new UI package was used.

Acceptance covers keyboard Arrow/Enter/Escape, real Link navigation, repeat selection of the current record, focus containment and return on mobile, stale query/account responses, partial failures, contract/subtype navigation gates, and 320px/390px/desktop overflow. Automated UI checks are saved with this report; actual Chrome screenshots and responsive acceptance are completed by the root agent after a production build.
