# Flutterwave webhook investigation brief

Prepared for the merchant to review and share with Flutterwave through its official support channel. This file has not been sent externally. It contains no credentials or bank details.

- Merchant: the current Live merchant account shown in the console, with V3 webhooks enabled.
- Existing successful transaction: the NGN 105.00 Company wallet payment. Copy its exact identifier from the merchant console when opening a support case; identifiers are omitted from this repository copy.
- Intended receiver: `https://obligon.onrender.com/api/webhooks/flutterwave`.
- The earlier root-only URL was corrected and persisted after reload.
- Native and API resends currently return HTTP 401, `Invalid signature`. The native log reached 10 attempts.
- The owner reports copying the actual Render `FLW_SECRET_HASH` value into the Live webhook Secret hash field and saving it.
- The running API accepts a nonfinancial ignored event signed with its configured secret.
- On real provider resends, safe rejection diagnostics show `hasV3VerificationHeader=true`, `hasV4SignatureHeader=false`, `headerIsPlaceholder=false`, `configuredHashPresent=true`.
- The receiver still compares the documented V3 `verif-hash` against its configured value. It does not accept unsigned events or use frontend payment claims.
- There is no accepted webhook receipt for this transaction. The separately confirmed payment has one NGN 100.00 wallet credit and remains unchanged after every resend.

Please investigate whether this transaction's resend uses the current Live webhook secret or a secret stored at the original attempt, and confirm which merchant/business configuration supplies its outgoing V3 header. Check for quoting, whitespace or encoding differences through a secure merchant support process. Provide delivery timestamps, header names and receiver status without exposing secret values in ordinary messages.

The public resend reference does not establish whether header credentials are regenerated after a configuration change. No undocumented API or additional payment has been used to work around that uncertainty.

Official references:

- [V3 webhook protocol](https://developer.flutterwave.com/docs/webhooks)
- [Transaction webhook resend](https://developer.flutterwave.com/reference/resend-transaction-webhook)
- [Integration best practices](https://developer.flutterwave.com/v3.0.0/docs/best-practices)
