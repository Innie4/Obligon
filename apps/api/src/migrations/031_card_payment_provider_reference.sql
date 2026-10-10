-- Preserve the verified processor charge for reconciliation and original-payment refunds.
ALTER TABLE card_requests ADD COLUMN provider_transaction_id VARCHAR(160);
CREATE UNIQUE INDEX card_requests_provider_charge_uidx ON card_requests(payment_provider,provider_transaction_id)
WHERE provider_transaction_id IS NOT NULL;
