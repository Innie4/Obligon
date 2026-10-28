-- Preserve legacy quotes and periods; all new Company sales use the public annual catalog.
ALTER TABLE subscription_payments ADD COLUMN IF NOT EXISTS billing_interval varchar(10) NOT NULL DEFAULT 'month';
ALTER TABLE subscription_payments ADD CONSTRAINT subscription_payments_billing_interval_check CHECK (billing_interval IN ('month','year'));
COMMENT ON COLUMN subscription_payments.billing_interval IS 'Quoted paid period, frozen at checkout; legacy quotes remain monthly.';
INSERT INTO pricing_plans(code,name,price_kobo,interval,features,highlighted,active) VALUES
 ('organization_starter','Starter',15000000,'year','["Up to 10 Vehicles","Basic Reporting","50 Partner Stations"]'::jsonb,false,true),
 ('organization_business','Business',25000000,'year','["Up to 50 Vehicles","Advanced Analytics","250 Partner Stations","Dedicated Account Exec"]'::jsonb,true,true),
 ('organization_enterprise','Enterprise',50000000,'year','["Up to 200 Vehicles","Advanced Analytics","Custom API Integration","Full Network Access"]'::jsonb,false,true)
ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name,price_kobo=EXCLUDED.price_kobo,interval=EXCLUDED.interval,
 features=EXCLUDED.features,highlighted=EXCLUDED.highlighted,active=EXCLUDED.active;
UPDATE pricing_plans SET active=false WHERE code IN ('starter','growth','enterprise');
