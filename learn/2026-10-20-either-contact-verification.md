# Verify either contact

> 2026-10-20 · Send email and phone codes, and complete verification with either one.

## In short
Signup requests both codes. Confirming either contact completes account verification, while each contact keeps its own truthful status. Descope handles the new contact codes; Obligon still owns passwords, sessions and account roles.

## What changed
- `apps/api/src/lib/descope-verification.js`: requests and checks managed codes, normalizes Nigerian numbers and rejects proof for a different contact.
- `apps/api/src/migrations/034_contact_verification_provider.sql`: records each challenge's provider and destination.
- `apps/api/src/routes/auth.routes.js`: binds challenges, keeps attempts and consumption transactional, and returns `accountVerified` using either contact.
- `apps/api/src/routes/customer.routes.js`: includes that completion status in the profile.
- `apps/api/src/config/env.js`, `apps/api/.env.example`, `apps/api/README.md` and `docs/contact-verification.md`: configure and explain the provider.
- `apps/api/src/lib/sms.js`: normalizes domestic and bare Nigerian mobile numbers for later Termii messages.
- `apps/web/components/auth/VerificationUI.tsx`, `SuccessHonesty.tsx` and `components/dashboard/PartnerVerification.tsx`: show completion after one proof and allow optional second-contact verification.
- `apps/web/lib/services/client.ts` and `types.ts`: carry the selected channel and completion status.
- API tests cover provider responses, configuration, SMS payloads, verification flows, temporary partner accounts and invitations. Web tests cover partner verification, invitations, success messages and selected-channel requests.

## How it works
1. Signup asks Descope to send to both saved contacts. Each local challenge records its provider, destination and expiry.
2. The form submits six digits with the selected email or phone channel.
3. The API locks the verification record, enforces attempt limits, and asks the recorded provider to check the exact recipient.
4. A successful response verifies only that contact. `accountVerified` uses email OR phone; `allVerified` still means both.
5. The screen permits continuation. Choosing the optional second contact cancels a pending redirect before requesting another code.

## Why it's built this way
Separate contact flags prevent email proof from pretending that SMS can reach someone. A company invitation still needs email proof, and SMS alerts still need phone proof. Binding the provider to each challenge also keeps old application-generated codes usable when configuration changes.

## The concept worth knowing: evidence and policy
One working house key proves you can enter, but it does not prove every key works. Likewise, contact flags describe evidence, while `accountVerified` describes the product rule applied to that evidence. Changing the rule must not fabricate evidence.

## Watch out for
Real email delivery and application confirmation succeeded. SMS requests were accepted, but handset receipt is unconfirmed. Free delivery allowances are limited. Hosted secrets, migration and deployment have not been applied; this authentication change requires qualified human review before release.

## Check yourself
1. Why must email proof leave `phoneVerified` false?
<details><summary>Answer</summary>It provides no evidence of phone ownership or SMS delivery. Phone-specific features must still check phone proof.</details>

2. What if configuration changes while a code is outstanding?
<details><summary>Answer</summary>The challenge retains its original provider and destination, so confirmation uses the recorded proof source.</details>

3. Why cancel the redirect when optional verification opens?
<details><summary>Answer</summary>Otherwise the completed-account timer could send the user to their dashboard before they enter the second code.</details>

## Explain it back
Without looking at the code, explain in 2-3 sentences what this change does and why it works. If you get stuck, that's the part to reread.

*Made with Edirae Learn · edirae.com*
