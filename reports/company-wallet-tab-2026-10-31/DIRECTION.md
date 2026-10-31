# Company Billing wallet tab

Keep Obligon's green, navy text, bordered finance cards and responsive spacing. Add a clear Subscription / Wallet tab pair with 48px touch targets, visible keyboard focus, arrow/Home/End navigation and linked ARIA panels. Reuse the existing wallet balance, funding, allocation and payment-confirmation controls. Confirmed funding uses the existing centered success popup. An inactive subscription shows a clear explanation and a working View subscription action in Wallet, using the existing access check.

## Reference decisions

| Installed source | Decision |
| --- | --- |
| Superdesign | Adapt its direction-first workflow to the established Obligon dashboard. A new concept or hosted canvas is unnecessary for this focused navigation change. |
| Better Design | Adapt the restrained bordered tab rail and active-state separation from `components/tv-style/components/ui/tabs.tsx`; preserve Obligon tokens and avoid importing Radix or unrelated effects. |
| Design Taste | Apply the installed `taste-accessibility` guidance for tab semantics, keyboard navigation, readable labels, focus and touch targets. |
| Canvas UI | Not applicable: GPU or canvas effects do not help billing navigation. |
| Paper Shaders | Not applicable: animated textures add no useful information to a financial balance. |
| UI Layouts | Adapt the separate tab-list, trigger and panel structure from `packages/shadcn/src/radix/tabs.tsx` without introducing a new dependency. |
| Hyperiux Components | Not applicable: cursor, scroll and WebGL effects would distract from payment tasks. |
| Motion Primitives | Not applicable: no transition is necessary to select a billing panel; preserve the existing color transition and popup system. |
| Cursify | Not applicable: retain the native pointer and touch behavior; no source code copied. |
| Trickle UI Kit | Not applicable: animated text would interfere with scanning balances and payment confirmations. |

The ten-source installed catalog and the focused Better Design/UI Layouts sources were consulted locally. No hosted design service, external generation, runtime dependency or payment behavior was added. Browser verification belongs to the combined release checks; unit-level interaction tests cover tabs, callback routing, the live-data balance and funding confirmation.
