-- 016: one notification per event, and a wallet ledger that says what it is.
--
-- Two problems, both visible on the customer dashboard.
--
-- 1. wallet_ledger.reference was carrying the idempotency key. The customer's
--    wallet history therefore read "topup:6fcdbcfe-5aa9-4f88-a363-24060eca27f0"
--    instead of the payment reference "TRX-MUNG8GCWRPA". The key is what makes a
--    credit happen exactly once, so it cannot simply be dropped: it gets its own
--    column and the human reference moves into `reference`, which is the column
--    people read.
--
-- 2. A settled top-up could raise the same notification more than once. The
--    webhook and the reconciliation pass both call completeTopUp, and completion
--    is idempotent by a conditional UPDATE — so a row that had already been
--    credited could still be re-notified, and any re-run that moved the row back
--    to pending raised the whole pair again. The dashboard's activity feed then
--    showed the same payment several times, which is what made a correct balance
--    look wrong: three "N100 added to your wallet" entries against a N200 balance.
--
--    `event_key` gives an event an identity in the database rather than leaving
--    it to the caller's discretion. The unique index makes a second notification
--    for one settled top-up impossible rather than merely unlikely, and the
--    insert is suppressed rather than raised on, so the webhook, the reconciler
--    and the browser return can all fire for one payment with one notification.
--
-- Rollback: DROP the two columns. Notification dedupe reverts to the caller being
-- careful, and the ledger goes back to showing idempotency keys.

-- ================================================================== the ledger
-- First, because the notification cleanup below counts wallet credits and can
-- only do that once the credits are identifiable.
ALTER TABLE wallet_ledger
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- Top-up credits are the rows customers actually read, and they are also the
-- only ones whose `reference` is not their own key. Both columns are derived
-- from the top-up, so both are set together and both are derivable again on a
-- re-run. Three ways of recognising one, because the row has been through more
-- than one shape: it still holds the top-up's id, it has already been given the
-- payment reference, or it already carries the derived key. Deriving the key from
-- `reference` alone instead would not be safe: once this repair has replaced a
-- reference with a TRX reference, a second pass would read that as the key and
-- lose the link to the top-up for good.
UPDATE wallet_ledger l
SET reference = t.reference,
    idempotency_key = 'topup:' || t.id::text
FROM top_ups t
WHERE t.id::text = l.reference
   OR l.reference = t.reference
   OR l.idempotency_key = 'topup:' || t.id::text;

-- Every other row's reference IS its idempotency key, because those were written
-- through a path that never passed a separate human reference. Copying it across
-- means the dedupe lookups keep finding the same rows they found before, so this
-- changes what customers read without changing what the system does.
UPDATE wallet_ledger
SET idempotency_key = reference
WHERE idempotency_key IS NULL;

-- Those same rows say "Top-up via undefined". The reconciler described them from
-- a column it had not selected, and the description was stored, so it cannot be
-- corrected by re-deriving it — but the processor that took the payment is
-- recorded on the top-up, and the wallet can be told which one it was.
UPDATE wallet_ledger l
SET description = 'Top-up via ' || coalesce(t.provider, 'payment provider')
FROM top_ups t
WHERE l.idempotency_key = 'topup:' || t.id::text
  AND l.description LIKE 'Top-up via undefined%';

-- The invariant creditWalletOnce / debitWalletOnce enforce by a
-- read-then-insert inside a transaction, stated as a constraint as well. Without
-- it, two concurrent paths that do not hold the same wallet row lock could each
-- read "not present" and both write, and the second write would be invisible.
CREATE UNIQUE INDEX IF NOT EXISTS wallet_ledger_idempotency_key_idx
  ON wallet_ledger(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- =========================================================== the notifications
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS event_key TEXT;

-- Historical rows are deliberately left with a NULL event key. The key that
-- prevents a repeat has to name the thing that happened, and the only such name
-- for a past notification is the top-up it described — which this table does not
-- record. Deriving one from the amount instead would merge two genuinely separate
-- payments of the same size, which is a worse error than a duplicate line: it
-- would delete the record of money that really arrived. The data below is
-- therefore repaired against the ledger, which does know.
--
-- New notifications from this point on carry `topup:<id>:credited`.

-- The reconciler used to raise a "Top-up credited" of its own on top of the
-- "Transaction Alert" completeTopUp always sends, so every settled top-up that
-- went through reconciliation produced a pair for one event. The reconciler no
-- longer sends one, and these rows are that second copy.
DELETE FROM notifications
WHERE title = 'Top-up credited'
  AND body LIKE 'We confirmed your payment of%';

-- A repeated "Transaction Alert" is one top-up settled and notified more than
-- once. The wallet ledger is the arbiter: a customer must not be told "N100 added
-- to your wallet" more times than N100 was actually added to their wallet. For
-- each (user, amount) only as many alerts as there are matching credits survive,
-- and the newest are kept because the newest alert follows the credit the
-- customer can see in their history.
--
-- The amount is pulled out as the first number in the body, decimal part
-- included when present. Stripping every non-digit instead would leave the
-- sentence's full stop behind and produce "100." , which is not a number.
WITH credits AS (
  SELECT w.user_id, l.amount_kobo, count(*)::int AS credited
  FROM wallet_ledger l
  JOIN wallets w ON w.id = l.wallet_id
  WHERE l.direction = 'credit' AND l.idempotency_key LIKE 'topup:%'
  GROUP BY w.user_id, l.amount_kobo
),
alerts AS (
  SELECT n.id,
         n.user_id,
         row_number() OVER (
           PARTITION BY n.user_id,
                        (regexp_replace(substring(n.body from '[0-9][0-9,]*\.[0-9]+|[0-9][0-9,]*'), ',', '', 'g')::numeric * 100)::bigint
           ORDER BY n.created_at DESC
         ) AS rank,
         (regexp_replace(substring(n.body from '[0-9][0-9,]*\.[0-9]+|[0-9][0-9,]*'), ',', '', 'g')::numeric * 100)::bigint AS amount_kobo
  FROM notifications n
  WHERE n.title = 'Transaction Alert'
    AND n.body LIKE 'Success:%added to your wallet.%'
    AND substring(n.body from '[0-9]') IS NOT NULL
)
DELETE FROM notifications
WHERE id IN (
  SELECT a.id
  FROM alerts a
  JOIN credits c ON c.user_id = a.user_id AND c.amount_kobo = a.amount_kobo
  WHERE a.rank > c.credited
);

-- An alert with no matching credit is a statement the ledger does not support —
-- a notification from before ledger rows carried idempotency keys, for instance.
-- Those are left alone rather than deleted: this migration removes demonstrable
-- repeats, and a notification is not money.

-- Created last, once the data can satisfy it. Building it before the cleanup
-- fails on the very duplicates this migration exists to remove.
CREATE UNIQUE INDEX IF NOT EXISTS notifications_event_key_idx
  ON notifications(event_key)
  WHERE event_key IS NOT NULL;
