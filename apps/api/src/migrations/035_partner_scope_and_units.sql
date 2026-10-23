-- Partner authorization belongs to the organization, including its staff.
-- Additive migration; historical quantities retain their original litre unit.
SET LOCAL lock_timeout = '5s';
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_partner_type_check;
ALTER TABLE users ADD CONSTRAINT users_partner_type_check CHECK (partner_type IN ('fuel_station','gas_station','mechanic','other'));
ALTER TABLE partner_applications DROP CONSTRAINT IF EXISTS partner_applications_partner_type_check;
ALTER TABLE partner_applications ADD CONSTRAINT partner_applications_partner_type_check CHECK (partner_type IN ('fuel_station','gas_station','mechanic','other'));
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS partner_type TEXT NOT NULL DEFAULT 'fuel_station'
  CHECK (partner_type IN ('fuel_station','gas_station','mechanic','other'));
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS partner_services TEXT[] NOT NULL DEFAULT '{}';
UPDATE organizations o SET partner_type=CASE
  WHEN o.type='mechanic' OR u.role='mechanic' OR u.partner_type='mechanic' THEN 'mechanic'
  WHEN u.partner_type='other' THEN 'other' ELSE 'fuel_station' END
FROM users u WHERE u.id=o.owner_user_id AND o.type IN ('partner','mechanic');
UPDATE organizations o SET partner_type='gas_station'
WHERE o.type='partner' AND o.partner_type='fuel_station'
  AND EXISTS(SELECT 1 FROM stations s WHERE s.partner_org_id=o.id AND cardinality(s.fuels)>0)
  AND NOT EXISTS(SELECT 1 FROM stations s CROSS JOIN LATERAL unnest(s.fuels) f
    WHERE s.partner_org_id=o.id AND upper(trim(f)) !~ '^(CNG( COMPRESSED GAS)?|LPG( GAS| AUTOGAS)?|GAS)$');

ALTER TABLE stations ADD COLUMN IF NOT EXISTS selling_units JSONB NOT NULL DEFAULT '{}';
ALTER TABLE stations ADD COLUMN IF NOT EXISTS approved_selling_units JSONB NOT NULL DEFAULT '{}';
-- Existing liquid prices have a known litre contract. Gas units require review.
WITH units AS (
  SELECT station_id,jsonb_object_agg(code,'litre'::text) AS values FROM (
    SELECT DISTINCT station_id,CASE
      WHEN upper(trim(fuel_type)) IN ('PMS','PMS PETROL','PETROL','UNLEADED') THEN 'PMS'
      WHEN upper(trim(fuel_type)) IN ('AGO','AGO DIESEL','DIESEL') THEN 'AGO'
      WHEN upper(trim(fuel_type)) IN ('DPK','DPK KEROSENE','KEROSENE') THEN 'DPK' END code
    FROM fuel_prices
  ) f WHERE code IS NOT NULL GROUP BY station_id
) UPDATE stations s SET selling_units=u.values,approved_selling_units=u.values
FROM units u WHERE u.station_id=s.id;

ALTER TABLE fuel_prices ADD COLUMN IF NOT EXISTS selling_unit TEXT NOT NULL DEFAULT 'litre' CHECK (selling_unit IN ('litre','kg','scm'));
ALTER TABLE fuel_price_history ADD COLUMN IF NOT EXISTS selling_unit TEXT NOT NULL DEFAULT 'litre' CHECK (selling_unit IN ('litre','kg','scm'));
ALTER TABLE fuel_orders ADD COLUMN IF NOT EXISTS selling_unit TEXT NOT NULL DEFAULT 'litre' CHECK (selling_unit IN ('litre','kg','scm'));
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS selling_unit TEXT NOT NULL DEFAULT 'litre' CHECK (selling_unit IN ('litre','kg','scm'));
ALTER TABLE fueling_logs ADD COLUMN IF NOT EXISTS selling_unit TEXT NOT NULL DEFAULT 'litre' CHECK (selling_unit IN ('litre','kg','scm'));
COMMENT ON COLUMN stations.approved_selling_units IS 'Admin-approved canonical fuel code to selling unit; owners submit selling_units for review';
COMMENT ON COLUMN fuel_orders.litres IS 'Historical column name; numeric quantity in the immutable selling_unit of this order';
COMMENT ON COLUMN transactions.litres IS 'Historical column name; numeric quantity in the immutable selling_unit of this transaction';
