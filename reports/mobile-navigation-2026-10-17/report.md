# Mobile landing actions and partner navigation

Date: 17 October 2026. Scope: the two requested mobile interface changes.

## Implemented

- Landing hamburger: Login is a navy-bordered link on a light filled background; Get Started is a green-bordered, green-filled link with white text. Both have 44px minimum touch targets and visible keyboard focus. Routes and close-on-selection behavior are preserved. Desktop actions and desktop links now share the `lg` breakpoint so tablets do not show duplicated actions.
- Partner console: Home, Transactions, Stations, Analytics and Payouts are fixed at the bottom below 1024px. Account is in the header, matching the customer console pattern. Subscription, Fuel Pricing, Staff Management, Card Verification POS, Disputes & Support, Notifications, Verify Account and System Settings remain available there, together with Sign Out.
- Mechanics retain their existing permitted destinations: four primary links and three Account links. The underlying authorization and subscription gates were not changed.
- The menu closes on selection, route change, outside pointer, focus leaving, Escape and transition to desktop. Escape restores focus to Account. Desktop transition also unmounts any nested sign-out confirmation and releases its existing focus/scroll controls.
- Bottom spacing reserves the navigation height and device safe-area inset. The Account popup scrolls on short screens. Mobile header stacking keeps confirmation controls above the bottom bar; desktop sidebar behavior is preserved.

## Verification

- Full web suite: **308 tests passed, 0 failed, 0 skipped**, using `node --test --experimental-test-isolation=none tests/*.test.cjs` from `apps/web`.
- Independent review: **24 focused tests passed**; no remaining actionable findings after correcting dropdown anchoring, confirmation stacking and desktop-transition cleanup.
- Scoped Next lint: no warnings or errors in the four modified UI components.
- Production build: passed, including TypeScript validation and route generation. It continues to report existing unused-variable warnings elsewhere and the outer/checkout lockfile root warning. No dependencies, configuration or unrelated pages were changed.
- Browser: Chrome, local application. Measured partner navigation at 320, 390, 768 and 1024px; mobile bar and Account visible below the desktop breakpoint, sidebar visible at 1024px, no document horizontal overflow, bottom padding 80px on mobile and 0 on desktop. Landing inspected at 320/390/768/1024/1440px.
- At 320×480, Account remained inside 20px horizontal gutters with a 320px scrolling area for 448px of content. Sign Out remained reachable. At both short and regular phone heights, hit-testing the confirmation's Cancel control identified Cancel above the bottom bar. Cancel restored focus; Escape closed Account and focused its button.
- Opening mobile Sign Out and switching to 1024px removed the menu and dialog; vertical scrolling was restored.
- Existing brand token contrast: white/green 6.44:1; navy/light fill 19.83:1; inactive navigation text/white 9.35:1; green/light fill 6.14:1.

## Design references and limits

The UI Reference Guide's ten-source catalog informed selection. Existing Obligon components and the local Design Taste accessibility reference supplied the chosen restrained navigation pattern. No new design dependencies, hosted design accounts or generated imagery were needed. Edirae Learn documents the implementation.

TasteSkill source lint flagged two pre-existing header divider classes and its existing backdrop blur. These were retained as established brand/layout details; changing them is outside the requested action styling. Its standalone inspector launches a separate browser and cannot be used under this session's browser-control requirement. Equivalent responsive screenshots and DOM measurements were collected through the supported browser tool; no standalone-inspector pass is claimed.

Local fixture mode cannot load the partner subscription gate, so local checks establish shell/menu behavior, not API availability. The normal local login form was used with synthetic fixture details. Browser extensions added a body attribute that produced development hydration warnings; their warning identifies that injected attribute. No screen reader or physical device safe-area test was performed. Live deployment verification is recorded separately after push.

## Recovery

This is a frontend-only change with no data migration or API contract change. Reverting its commit restores the prior navigation. The active one-day test-account deadline is unchanged.
