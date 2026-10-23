# Verify the card request, then its identity

> 2026-10-24 · Customer card details, email confirmation and administrator BVN review

## In short
The card popup now accepts Nigerian national phone numbers, uses dependent State/City choices and allows an omitted postal code. A card-specific email code confirms the submission; an administrator separately starts the provider’s BVN consent process and checks the returned identity before issuance.

## What changed
- `apps/web/components/customer-dashboard/CardIdentityModal.tsx` and `CardIdentityReviewStatus.tsx` provide details, email, correction and consent states. `CardRequestModals.tsx` reuses the form; `CustomerScreen.tsx` connects its saved progress.
- `apps/web/components/admin-dashboard/CardApprovalQueue.tsx` shows the evidence, recovery controls and approval requirements. `apps/web/lib/card-identity.ts`, `lib/services/client.ts` and `types.ts` validate inputs and define the requests.
- `apps/api/src/lib/card-identity.js` binds submissions and email codes to a revision. `card-identity-email.js` checks a separate Descope challenge; `bvn-verification.js` reads actual Flutterwave BVN results.
- `apps/api/src/routes/customer.routes.js` and `admin.routes.js` connect the APIs and real admin destination. The admin query preserves the birth date as a calendar date. `lib/card-approval.js` checks evidence before issuer calls; `config/env.js` and `apps/api/.env.example` add the disabled-by-default BVN switch.
- `apps/api/src/lib/nigeria-address.js` and migrations `040_nigeria_city_catalog.sql`/`041_card_identity_verification.sql` store the sourced city catalog and private verification state.
- API tests `card-identity.test.mjs`, `card-identity.integration.test.mjs`, `nigeria-address.test.mjs`, `database-private-access.integration.test.mjs`, `card-approval.integration.check.mjs` and `card-request-flow.check.mjs`, plus web `card-identity.test.cjs`, verify the changed contracts and recovery paths.

## How it works
1. The server validates the address and phone, encrypts the BVN and creates an identity revision.
2. An expiring, limited-attempt email challenge confirms that revision and account email. The live Descope test passed.
3. An admin requests a BVN check. The customer completes hosted consent when required; the admin retrieves the result.
4. Returned BVN, names and birth date must match. Approval also requires current account details and the postal code required by Sudo.
5. Corrections replace the revision and clear old evidence. An admin can reconcile an uncertain start or archive a stale pending check, with an audit record.

## Why it's built this way
Email access and BVN identity are separate facts. Provider failures never become successful verification. State and City cannot identify a unique postcode, so the approved flow uses an optional field and the official finder instead of guessing.

## The concept worth knowing: revision binding
**Simply put:** a signed parcel label belongs to one parcel. Moving it to a different parcel does not verify its contents.

**More precisely:** email and BVN evidence refer to the exact `identity_revision`. Database locks and operation identifiers prevent overlapping requests or late provider replies from restoring superseded evidence.

## Watch out for
Real BVN verification remains untested without provider enablement and credentials. Sudo requires a postal code before issuance even though submission permits a blank. The city snapshot includes towns and villages and does not prove residence. Qualified human review is required before release.

## Check yourself
1. Why cannot a signup email code approve card details?
   <details><summary>Answer</summary>It has a different purpose. Card confirmation requires its own revision-bound challenge and provider claim.</details>
2. What if a provider result arrives after an admin archives the check?
   <details><summary>Answer</summary>The operation, status and revision guards reject the late result.</details>
3. Why send the birth date as a date string?
   <details><summary>Answer</summary>A date identifies a calendar day. Converting local midnight to UTC can display the preceding day.</details>

## Explain it back
Without looking at the code, explain in 2-3 sentences what this change does and why it works. If you get stuck, that's the part to reread.

*Made with Edirae Learn · edirae.com*
