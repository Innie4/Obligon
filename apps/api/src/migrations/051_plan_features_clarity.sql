-- Clarify Loyalty Rewards and Partner Discounts in card plan features catalog
UPDATE card_plans SET features=(
  SELECT jsonb_agg(
    CASE
      WHEN f->>'label'='Loyalty Rewards' AND f->>'state'='Premium' THEN jsonb_set(f,'{state}','"5% Cashback"'::jsonb)
      WHEN f->>'label'='Partner Discounts' THEN jsonb_set(f,'{state}','"Full Discount"'::jsonb)
      ELSE f
    END
  ) FROM jsonb_array_elements(features) f
);
