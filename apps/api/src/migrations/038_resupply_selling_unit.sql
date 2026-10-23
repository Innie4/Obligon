-- Resupply requests retain whole quantities in their approved physical unit.
ALTER TABLE resupply_orders ADD COLUMN IF NOT EXISTS selling_unit TEXT NOT NULL DEFAULT 'litre'
  CHECK (selling_unit IN ('litre','kg','scm'));
COMMENT ON COLUMN resupply_orders.litres IS 'Historical column name; whole requested quantity in selling_unit';

ALTER TABLE fuel_price_history ADD COLUMN IF NOT EXISTS old_selling_unit TEXT
  CHECK (old_selling_unit IN ('litre','kg','scm'));
UPDATE fuel_price_history SET old_selling_unit=selling_unit
  WHERE old_selling_unit IS NULL AND old_price_kobo IS NOT NULL;
