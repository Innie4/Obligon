-- Legacy card requests predate paid-plan checkout: they have no
-- payment_reference, so they can never be verified or cancelled and would leave
-- the customer permanently blocked by the one-open-request index. They were
-- never paid for, so retire them rather than stranding the account.

UPDATE card_requests
SET status = 'cancelled',
    notes = CASE
      WHEN notes = '' THEN 'Cancelled automatically: created before paid-plan checkout was introduced.'
      ELSE notes
    END,
    updated_at = now()
WHERE payment_reference IS NULL
  AND status IN ('awaiting_payment', 'pending');
