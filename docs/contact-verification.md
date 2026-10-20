# Email and Nigerian phone verification

The optional Descope integration verifies contact ownership. Obligon continues to own passwords, sessions, roles, memberships and account access. Other transactional emails, SMS alerts and password-reset messages retain the existing Resend/Termii delivery paths.

## Server configuration

Apply migration 034 before running the new API. Add these fields only to the ignored server environment or hosted secret store:

    VERIFICATION_PROVIDER=descope
    DESCOPE_PROJECT_ID=<project ID>
    DESCOPE_AUTH_MANAGEMENT_KEY=<project-scoped Authentication key>

The management key is a secret. Never use a NEXT_PUBLIC variable, put it in a frontend bundle, or commit it. Use the Authentication role on this project only, without company-wide or full-management access. Record and rotate its expiry. The initial test key was created with a 90-day lifetime.

In the Descope console:

1. Keep the Free plan; no billing/card setup is required for the account used in this test.
2. In Authentication Methods > One-time Password, keep Disable API & SDK selected. Server requests authenticate with the project ID and Authentication management key.
3. Use the Descope default connector for email and text messages. The current provider expiry is set to ten minutes to match the local challenge lifetime. Provider throttling can be stricter than Obligon's outer limit of five incorrect guesses.
4. Do not enable test-user shortcuts for production verification.

The official [free tier](https://www.descope.com/pricing) lists 100 SMS/voice deliveries per month and 1,000 emails per day. Retries and test messages consume the same allowance. This is a limited recurring allowance, not unlimited delivery. Check the current console/pricing before launch or changing plans.

## Request and proof

Signup requests both codes using the account's saved email and phone number. Either successful email or phone confirmation completes account verification. The other contact stays unverified and can be confirmed later through the verification page. A failed SMS delivery does not block an account whose email is verified.

Confirmation specifies the selected email or phone channel so an SMS code does not consume email verification attempts. `accountVerified` means at least one verified contact; `allVerified` continues to mean both contacts. Opening the verification page for an already verified account does not automatically send another code.

Contact-specific requirements still apply: accepting a company invitation requires verified email, and enabling SMS alerts requires verified phone. Company contract approval, membership access, card checks and MFA remain separate.

Each challenge stores its delivery provider and intended destination. A configuration change does not reinterpret an already-issued application-generated code as a Descope code. The API retains local expiry, wrong-attempt limits, account/record locking and single-use consumption.

Only a successful server-to-provider verification response for the exact expected contact and channel can update that contact's local verified flag. Test-user proof, mismatched contacts and unknown responses are refused. Descope session tokens are discarded, never returned as Obligon sessions or used to merge accounts.

Transport errors and provider outages fail closed. POST requests are not automatically retried. Accepted sends are not proof of inbox or handset receipt. An account remains phone-unverified until a phone code is confirmed.

Nigerian SMS destinations accept domestic, national-mobile and international formatting, then normalize to +234 followed by ten digits. Formatting validation does not prove carrier allocation, number ownership or delivery.

## Acceptance and rollout

Before production release, obtain qualified human review of the exact authentication/data-flow changes, verify the migration and focused regressions, and configure hosted secrets through the approved deployment path. The existing application-generated path remains available through VERIFICATION_PROVIDER=local; that value describes challenge ownership, not local-outbox delivery. EMAIL_PROVIDER=local and SMS_PROVIDER=local remain forbidden in production.

Check both channels with approved real test destinations. Confirm the codes through the application, verify only the intended local flag changes, then test replay, wrong contact, changed contact, unavailable provider and exhausted attempts. Use isolated data for these failure checks.

The 20 October tests confirmed email receipt, provider verification and confirmation through Obligon's application. The updated mobile verification screen accepted email-only completion and continued into the customer dashboard. SMS requests were accepted, but the user reported no handset receipt. Do not claim working Nigerian SMS or mark a phone verified based on an accepted request alone.

Resend's configured sender still needs a verified domain for general transactional delivery. Descope contact verification does not fix that independent requirement. Review external verification-record retention and the privacy notice before production use.

Official API sources: [email request](https://docs.descope.com/api/otp/email/sign-in-auto-sign-up), [SMS request](https://docs.descope.com/api/otp/sms/sign-in-auto-sign-up), [email proof](https://docs.descope.com/api/otp/email/verify-otp), [SMS proof](https://docs.descope.com/api/otp/sms/verify-otp), and [trigger settings](https://docs.descope.com/auth-methods/otp/settings).
