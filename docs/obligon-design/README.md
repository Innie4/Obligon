# New interface design and integration

The requested app-designer workflow was adapted to the existing responsive web application. The scope is station publication, admin intake/activity/delivery, partner service requests and restricted API-key management. Existing navigation, brand and web typography remain.

Research references: [WEX fleet analytics](https://www.wexinc.com/products/fuel-cards-fleet/analytics-reporting/), [Shell Fleet Hub](https://www.shell.com/business-customers/shell-fleet-solutions/digital-and-payment-solutions/digital-solutions/shell-fleet-hub.html), and [Stripe dashboard search](https://docs.stripe.com/dashboard/search). These informed readable transaction history, operational next actions and searchable records; they are not proof that Obligon has equivalent capabilities.

Rendered studies: `station-register.html`, `dispatch-room.html`, `forecourt-board.html`. All three passed the app-designer mechanical scan. Printed-register hierarchy won because evidence and review decisions stay adjacent. Dispatch room lost because its density and amber palette depart from existing customer-facing screens. Forecourt board lost because signage-style scale gives insufficient space to review notes and long records.

Integration uses existing responsive React components and authenticated APIs. Queue states include loading, empty, failure, pending review, accepted delivery and reconciliation-required. Plain text status accompanies color. Actions use record IDs, server references and actual backend outcomes. No decorative asset is required.

See `DIRECTION.md` for tokens and `CRITIQUE.md` for the separate self-review. The concept HTML files are studies, not production code. Local screenshots prove the implemented admin/station flows, while API tests prove authorization and persistence.

History row pending export to the personal design history: 2026-10-10 | Obligon station/intake | printed register | light | serif study / existing sans implementation | green | ruled evidence surfaces. Personal skill files were not modified.
