# Mobile menus that keep every destination reachable

> 2026-10-17 · Style the landing menu actions and give partners customer-style mobile navigation.

## In short
The landing menu now presents Login and Get Started as filled, bordered links. The partner dashboard puts frequent destinations in a fixed bottom bar and keeps the remaining sections, including sign-out, in an Account menu in the header.

## What changed
- `apps/web/components/landing/Header.tsx`: added button styling, touch targets and focus rings; aligned desktop actions with the desktop navigation breakpoint.
- `apps/web/components/dashboard/MobileDashboardNav.tsx`: partitions existing destinations, renders the bottom bar and implements `MobilePartnerAccount`.
- `apps/web/components/dashboard/DashboardHeader.tsx`: places Account beside notifications and keeps its confirmation above the bottom bar.
- `apps/web/components/dashboard/PartnershipShell.tsx`: reserves bottom space and removes the former scrolling menu and separate sign-out row.
- `apps/web/tests/landing-mobile-menu.test.cjs` and `partner-mobile-navigation.test.cjs`: exercise destinations, menu state, role filtering, active routes, dismissal and cleanup.
- `apps/web/tests/production-auth-navigation.test.cjs`: verifies the shell still mounts navigation and the existing plan gate on approved mechanic routes.

## How it works
1. The mobile components read the existing navigation catalog and current session role.
2. Partners get Home, Transactions, Stations, Analytics and Payouts in the bottom bar. Mechanics receive only their existing permitted destinations.
3. Every other catalog destination appears once in Account. Selecting a link closes that menu, while normal links perform navigation.
4. Escape closes Account and restores button focus. Outside clicks, focus leaving the menu and route changes also close it.
5. A media-query listener closes Account when the desktop sidebar takes over. Unmounting its sign-out dialog releases the existing dialog focus and scrolling controls.

## Why it's built this way
The catalog remains the source of destinations, which prevents a second mobile list drifting away from desktop routes. Native links preserve ordinary browser navigation; buttons control disclosure state. Keeping the desktop sidebar avoids changing familiar desktop workflows. The bottom padding includes the device safe area so the fixed bar has room without hiding the last page controls.

## The concept worth knowing: lifecycle cleanup
**Simply put:** opening a popup is like borrowing a room: when you leave, return its keys and turn off its lights.

**More precisely:** React effects attach document and media-query listeners while Account is open. Their cleanup removes those listeners when it closes or unmounts. Closing the responsive subtree also unmounts any confirmation dialog so its focus trap and scroll lock cannot remain active invisibly on desktop.

## Watch out for
- The mechanic filter preserves existing UI restrictions; it is not a replacement for API authorization.
- Short screens need internal menu scrolling. Header stacking must keep confirmation controls above the bottom bar.
- Local fixture mode cannot load the partner billing gate; its shell and menu were checked separately. Live checks and build results are recorded in the task report.
- No screen-reader session or physical device safe-area test was performed.

## Check yourself
1. Why reuse the navigation catalog?
   <details><summary>Answer</summary>It lets tests prove that every existing route appears exactly once across the two mobile groups.</details>

2. What if Account only became visually hidden on desktop?
   <details><summary>Answer</summary>A mounted confirmation could keep trapping focus and locking scrolling despite being invisible. Closing Account unmounts that dialog and runs cleanup.</details>

3. Why reserve space beneath the content?
   <details><summary>Answer</summary>A fixed bar does not occupy normal document space. Padding lets the last controls scroll above it.</details>

## Explain it back
Without looking at the code, explain in 2-3 sentences what this change does and why it works. If you get stuck, that's the part to reread.

*Made with Edirae Learn · edirae.com*
