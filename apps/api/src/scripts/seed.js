import bcrypt from "bcryptjs";
import { q, one, tx } from "../db.js";
import { supabaseAuthEnabled, supabaseSignUp, LOCAL_AUTH_PLACEHOLDER } from "../lib/supabaseAuth.js";

/**
 * Seeds demo data for every role. Idempotent: skips if the admin user exists.
 * Demo credentials (change in production):
 *   admin@obligon.com     | Admin#1234
 *   customer@obligon.com  | Customer#123
 *   fleet@obligon.com     | Company#123
 *   partner@obligon.com   | Partner#123
 */
const PASSWORD = {
  admin: "Admin#1234",
  customer: "Customer#123",
  company: "Company#123",
  partner: "Partner#123"
};

async function upsertUser({ email, password, name, role, org, tier = "Standard Account", phone = null, verified = true }) {
  const existing = await one("SELECT id FROM users WHERE email = $1", [email]);
  if (existing) return existing.id;
  let hash = await bcrypt.hash(password, 10);
  let supabaseUid = null;
  if (supabaseAuthEnabled()) {
    // Credentials live in Supabase Auth; the local hash column is a placeholder.
    const authUser = await supabaseSignUp({ email, password, fullName: name });
    supabaseUid = authUser.authUserId ?? null;
    hash = LOCAL_AUTH_PLACEHOLDER;
  }
  const row = await one(
    `INSERT INTO users (email, password_hash, full_name, role, organization_name, account_tier, phone, email_verified, phone_verified, supabase_auth_uid)
     VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE,$8,$9) RETURNING id`,
    [email, hash, name, role, org, tier, phone, Boolean(phone), supabaseUid]
  );
  return row.id;
}

async function main() {
  const existing = await one("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
  if (existing) {
    console.log("Seed data already present — skipping.");
    process.exit(0);
  }

  // Users
  const adminId = await upsertUser({ email: "admin@obligon.com", password: PASSWORD.admin, name: "Amara Okafor", role: "admin", org: "Obligon LTD Internal", tier: "Platform Admin" });
  const customerId = await upsertUser({ email: "customer@obligon.com", password: PASSWORD.customer, name: "Femi Balogun", role: "customer", org: "Obligon LTD Enterprise", tier: "Premium Account", phone: "+2348012345678" });
  const companyId = await upsertUser({ email: "fleet@obligon.com", password: PASSWORD.company, name: "Adekunle Smith", role: "company", org: "Haulage Dynamics Ltd", tier: "Enterprise Account" });
  const partnerId = await upsertUser({ email: "partner@obligon.com", password: PASSWORD.partner, name: "Chidi Nwosu", role: "partner", org: "Core Hub Fuel Station", tier: "Verified Partner", phone: "+2348087654321" });

  await q("INSERT INTO wallets (user_id, balance_kobo, budget_limit_kobo) VALUES ($1, 48500000, 50000000) ON CONFLICT (user_id) DO NOTHING", [customerId]);

  // Organizations
  const companyOrg = await one(
    `INSERT INTO organizations (owner_user_id, name, type, plan_code, subscription_status, next_billing_date, credit_limit_kobo, verification_status, rc_number, address, city, fleet_id)
     VALUES ($1,'Haulage Dynamics Ltd','company','enterprise','active', now() + interval '20 days', 1000000000, 'verified','RC-482911','12 Apapa Wharf Road','Lagos','FLT-ODY-8492') RETURNING id`,
    [companyId]
  );
  const partnerOrg = await one(
    `INSERT INTO organizations (owner_user_id, name, type, plan_code, subscription_status, settlement_limit_kobo, auto_settlement, verification_status, rc_number, address, city)
     VALUES ($1,'Core Hub Fuel Station','partner','network','active', 50000000, TRUE, 'verified','RC-119042','120 Financial District Blvd','Lagos') RETURNING id`,
    [partnerId]
  );
  const companyOrgId = companyOrg.id;
  const partnerOrgId = partnerOrg.id;

  await q(
    `INSERT INTO memberships (organization_id, user_id, email, role, status) VALUES
      ($1,$2,'fleet@obligon.com','owner','active'),
      ($3,$4,'partner@obligon.com','owner','active')`,
    [companyOrgId, companyId, partnerOrgId, partnerId]
  );

  // Vehicles & drivers
  const vehicles = [];
  for (const [plate, model, type, fuel] of [
    ["FLT-8492", "Mercedes Actros", "truck", "diesel"],
    ["FLT-3310", "Toyota Hilux", "pickup", "petrol"],
    ["FLT-5521", "BYD eTruck", "truck", "electric"],
    ["FLT-1198", "Iveco Stralis", "truck", "diesel"],
    ["FLT-7740", "MAN TGS", "truck", "diesel"]
  ]) {
    vehicles.push(await one(
      `INSERT INTO vehicles (organization_id, plate, model, vehicle_type, fuel_type) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [companyOrgId, plate, model, type, fuel]
    ));
  }
  const drivers = [];
  for (const [name, phone, license] of [
    ["Ibrahim Musa", "+2348033445566", "LAG-DRV-88213"],
    ["Grace Etim", "+2348055667788", "LAG-DRV-77190"],
    ["Tunde Adeyemi", "+2348077889900", "LAG-DRV-66554"]
  ]) {
    drivers.push(await one(
      `INSERT INTO drivers (organization_id, name, phone, license_no) VALUES ($1,$2,$3,$4) RETURNING *`,
      [companyOrgId, name, phone, license]
    ));
  }

  // Station + prices
  const station = await one(
    `INSERT INTO stations (partner_org_id, name, address, city, lat, lng, fuels, hours, status)
     VALUES ($1,'Obligon Core Hub','120 Financial District Blvd','Lagos',6.4281,3.4219,'{PMS Petrol,AGO Diesel,LPG Gas}','Open 24/7','active') RETURNING *`,
    [partnerOrgId]
  );
  const station2 = await one(
    `INSERT INTO stations (partner_org_id, name, address, city, lat, lng, fuels, hours, status)
     VALUES ($1,'Metro Transit Station','45 Commerce Street','Lagos',6.4531,3.3958,'{PMS Petrol,AGO Diesel}','06:00 - 23:00','active') RETURNING *`,
    [partnerOrgId]
  );
  for (const [st, type, price] of [
    [station.id, "PMS Petrol", 99800],
    [station.id, "AGO Diesel", 108500],
    [station.id, "LPG Gas", 75000],
    [station2.id, "PMS Petrol", 101000],
    [station2.id, "AGO Diesel", 109900]
  ]) {
    await q("INSERT INTO fuel_prices (station_id, fuel_type, price_kobo) VALUES ($1,$2,$3) ON CONFLICT (station_id, fuel_type) DO NOTHING", [st, type, price]);
  }
  await q(`INSERT INTO equipment (station_id, name, kind, status) VALUES
    ($1,'Pump 01 — AGO','pump','operational'),
    ($1,'Pump 02 — PMS','pump','operational'),
    ($1,'LPG Dispenser','dispenser','maintenance')`, [station.id]);

  // Cards
  const cardRows = [];
  for (let i = 0; i < vehicles.length; i++) {
    const v = vehicles[i];
    const d = drivers[i % drivers.length];
    cardRows.push(await one(
      `INSERT INTO cards (owner_user_id, organization_id, vehicle_id, driver_id, label, holder_name, masked_pan, brand, expiry, status, daily_limit_kobo, monthly_limit_kobo, balance_kobo)
       VALUES ($1,$2,$3,$4,$5,'ADEKUNLE SMITH',$6,'VISA','09/28',$7,$8,$9,$10) RETURNING *`,
      [companyId, companyOrgId, v.id, d.id, `Fleet Card ${String(i + 1).padStart(2, "0")}`,
        `•••• •••• •••• ${4242 + i * 7}`, i === 4 ? "frozen" : "active", 200000, 2000000, 150000 + i * 25000]
    ));
  }

  // Transactions across last 30 days
  const stationsRows = [station, station2];
  for (let i = 0; i < 40; i++) {
    const c = cardRows[i % cardRows.length];
    const st = stationsRows[i % 2];
    const litres = 30 + ((i * 13) % 60);
    const pricePerL = (i % 2 === 0 ? 108500 : 99800) / 100;
    const amountKobo = Math.round(litres * pricePerL) * 100;
    await q(
      `INSERT INTO transactions (reference, customer_user_id, organization_id, station_id, vehicle_id, driver_id, card_id, fuel_type, litres, amount_kobo, status, meta, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'success',$11, now() - ($12 || ' days')::interval)`,
      [`TX-${(100000 + i * 37).toString(36).toUpperCase()}`, null, companyOrgId, st.id, c.vehicle_id, c.driver_id, c.id,
        i % 2 === 0 ? "AGO Diesel" : "PMS Petrol", litres, amountKobo, `${st.name} • ${litres}L`, String(i % 28)]
    );
  }
  await q(
    `INSERT INTO transactions (reference, customer_user_id, station_id, vehicle_id, fuel_type, litres, amount_kobo, status, meta, created_at)
     VALUES ('TX-CUST-001',$1,$2,NULL,'AGO Diesel',45,4612500,'success','Core Hub • 45L', now() - interval '2 hours'),
            ('TX-CUST-002',$1,$3,NULL,'PMS Petrol',60,6048000,'success','Metro Transit • 60L', now() - interval '1 day')`,
    [customerId, station.id, station2.id]
  );

  // Settlements + payouts + bank account
  const bank = await one(
    `INSERT INTO bank_accounts (organization_id, bank_name, bank_code, account_number_mask, account_name, is_default, verified, recipient_code)
     VALUES ($1,'GTBank','058','•••• 8891','Core Hub Fuel Station Ltd',TRUE,TRUE,'RCP_dummy') RETURNING *`,
    [partnerOrgId]
  );
  for (let m = 1; m <= 3; m++) {
    await q(
      `INSERT INTO settlements (partner_org_id, period_start, period_end, gross_kobo, fees_kobo, net_kobo, status, reference, paid_at)
       VALUES ($1, date_trunc('month', now()) - ($2 || ' months')::interval, date_trunc('month', now()) - ($2 || ' months')::interval + interval '1 month - 1 day', $3, $4, $5, 'paid',$6, now())`,
      [partnerOrgId, String(m), 1250000000 + m * 10000000, Math.round((1250000000 + m * 10000000) * 0.015), 1231250000 + m * 9850000, `STL-2026-${m}`]
    );
  }
  await q(
    `INSERT INTO payouts (partner_org_id, bank_account_id, amount_kobo, status, reference, created_at, paid_at)
     VALUES ($1,$2,45000000,'success','Payout-2026-001', now() - interval '5 days', now() - interval '4 days'),
            ($1,$2,30000000,'pending','Payout-2026-002', now() - interval '1 day', NULL)`,
    [partnerOrgId, bank.id]
  );

  // Plans
  await q(
    `INSERT INTO pricing_plans (code, name, price_kobo, interval, features, highlighted) VALUES
      ('starter','Starter', 2500000, 'month', '["Up to 5 vehicles","5 fuel cards","Basic reporting","Email support"]'::jsonb, FALSE),
      ('growth','Growth', 7500000, 'month', '["Up to 25 vehicles","Unlimited cards","Advanced analytics","Roadside assistance","Priority support"]'::jsonb, TRUE),
      ('enterprise','Enterprise', 15000000, 'month', '["Unlimited vehicles","Dedicated account manager","Custom credit limits","API access","SLA support"]'::jsonb, FALSE)
    ON CONFLICT (code) DO NOTHING`
  );
  await q(`INSERT INTO subscriptions (organization_id, plan_code, status, current_period_start, current_period_end)
           VALUES ($1,'enterprise','active', now() - interval '10 days', now() + interval '20 days') ON CONFLICT (organization_id) DO NOTHING`, [companyOrgId]);
  await q(
    `INSERT INTO invoices (organization_id, number, amount_kobo, status, period_start, period_end, description, created_at, paid_at) VALUES
      ($1,'INV-2026-0812',15000000,'paid', date_trunc('month', now()) - interval '1 month', date_trunc('month', now()) - interval '1 month' + interval '1 month - 1 day','Enterprise plan — monthly subscription', now() - interval '1 month', now() - interval '1 month' + interval '2 days'),
      ($1,'INV-2026-0912',15000000,'paid', date_trunc('month', now()), date_trunc('month', now()) + interval '1 month - 1 day','Enterprise plan — monthly subscription', now() - interval '10 days', now() - interval '8 days')`,
    [companyOrgId]
  );

  // Disputes
  const sampleTx = await one("SELECT * FROM transactions ORDER BY created_at DESC LIMIT 1");
  await q(
    `INSERT INTO disputes (transaction_id, raised_by_user_id, raised_by_role, organization_id, station_org_id, reference, subject, category, description, status)
     VALUES ($1,$2,'company',$3,$4,'DSP-2026-001','Incorrect amount charged','billing','Charged for 80L but dispensed 45L.','open'),
            (NULL,$5,'partner',$4,NULL,'DSP-2026-002','Duplicate charge on terminal 2','duplicate','Terminal printed two receipts for one sale.','in_review')`,
    [sampleTx.id, companyId, companyOrgId, partnerOrgId, partnerId]
  );

  // Support tickets
  await q(
    `INSERT INTO support_tickets (reference, user_id, organization_id, subject, category, message, status) VALUES
      ('TKT-2026-101',$1,$2,'Card frozen unexpectedly','cards','My fleet card 05 was frozen without action from our team.','active'),
      ('TKT-2026-102',$3,NULL,'Wallet top-up not reflecting','wallet','I made a transfer 2 hours ago and it has not reflected.','queued')`,
    [companyId, companyOrgId, customerId]
  );

  // Maintenance + roadside
  await q(
    `INSERT INTO maintenance_schedules (organization_id, vehicle_id, service_type, scheduled_date, status, cost_kobo, notes) VALUES
      ($1,$2,'Oil change', current_date + 7,'scheduled', 8500000,'Every 10,000km'),
      ($1,$3,'Tyre rotation', current_date - 3,'overdue', 4000000,'Rear tyres worn'),
      ($1,$4,'Full service', current_date + 21,'scheduled', 12500000,'60k service')`,
    [companyOrgId, vehicles[0].id, vehicles[1].id, vehicles[2].id]
  );
  await q(
    `INSERT INTO roadside_requests (organization_id, user_id, vehicle_id, location_text, issue_type, priority, details, status, eta_minutes, created_at)
     VALUES ($1,$2,$3,'Ikeja, Lagos — Oba Akran Avenue','Flat tyre','high','Driver safe, vehicle parked off-road.','in_progress',25, now() - interval '40 minutes')`,
    [companyOrgId, companyId, vehicles[1].id]
  );

  // Team members
  const managerId = await upsertUser({ email: "ops@obligon.com", password: PASSWORD.company, name: "Ngozi Eze", role: "company", org: "Haulage Dynamics Ltd" });
  if (!supabaseAuthEnabled()) {
    const managerHash = await bcrypt.hash(PASSWORD.company, 10);
    await q(`UPDATE users SET password_hash = $2 WHERE id = $1`, [managerId, managerHash]);
  }
  await q(
    `INSERT INTO memberships (organization_id, user_id, email, role, status) VALUES ($1,$2,'ops@obligon.com','manager','active')
     ON CONFLICT (organization_id, email) DO NOTHING`,
    [companyOrgId, managerId]
  );

  // Careers + content
  await q(
    `INSERT INTO job_postings (title, department, location, employment_type, description, requirements) VALUES
      ('Senior Backend Engineer','Engineering','Lagos, Nigeria (Hybrid)','Full-time','Build the APIs powering Nigeria''s fuel card network.','["5+ years Node.js","Postgres at scale","Fintech experience preferred"]'),
      ('Fleet Success Manager','Operations','Abuja, Nigeria','Full-time','Own onboarding and retention for enterprise fleets.','["3+ years B2B SaaS","Fleet/logistics domain"]'),
      ('Product Designer','Design','Remote','Contract','Design dashboard and mobile experiences.','["Portfolio required","Figma fluency"]')`
  );
  await q(
    `INSERT INTO content_items (kind, title, body, sort_order) VALUES
      ('product','Fuel Cards','Virtual fuel cards with real-time controls and spend limits.',1),
      ('product','Wallet & Top-ups','Fund your fleet wallet via card, transfer or USSD.',2),
      ('partner','Core Hub Fuel Station','Verified partner since 2024 — Lagos.',1),
      ('story','Haulage Dynamics cut fuel spend 18%','With Obligon analytics and card controls.',1)`
  );

  // Partner application awaiting review
  await q(
    `INSERT INTO partner_applications (reference, business_name, partner_type, contact_email, contact_phone, rc_number, address, city, status)
     VALUES ('APP-2026-041','Express Fueling Ltd','fuel_station','apply@expressfueling.ng','+2348099887766','RC-228411','88 Industrial Parkway','Lagos','submitted')`
  );

  // Notifications
  await q(
    `INSERT INTO notifications (user_id, title, body, category, created_at) VALUES
      ($1,'Transaction Alert','Success: ₦500,000.00 added to your wallet.','transactions', now() - interval '2 hours'),
      ($1,'Station Update','New Obligon Core Hub opened 2 miles from your current route.','general', now() - interval '4 hours'),
      ($1,'Security Alert','New login detected from a Chrome browser in Lagos.','security', now() - interval '1 day'),
      ($2,'New company onboarded','Haulage Dynamics Ltd completed verification.','general', now() - interval '3 hours')`,
    [customerId, adminId]
  );
  await q(
    `INSERT INTO notifications (organization_id, title, body, category, action_required, created_at) VALUES
      ($1,'Settlement ready','Your settlement for last month is ready for payout.','settlements',TRUE, now() - interval '6 hours')`,
    [partnerOrgId]
  );

  console.log("Seed complete.");
  console.log("Demo logins:");
  console.log("  admin    admin@obligon.com    / " + PASSWORD.admin);
  console.log("  customer customer@obligon.com / " + PASSWORD.customer);
  console.log("  company  fleet@obligon.com    / " + PASSWORD.company);
  console.log("  partner  partner@obligon.com  / " + PASSWORD.partner);
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
