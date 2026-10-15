/**
 * Money-movement unit tests.
 *
 * The HTTP suites can only prove that money routes are guarded. These prove the
 * arithmetic and the idempotency, which is where an accounting bug would actually
 * lose a customer their balance. An explicit local test database opt-in creates
 * one owned schema; cleanup drops only that schema and never deletes by prefix.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";

const stamp = Date.now();
const database = process.env.OBLIGON_TEST_DATABASE_URL;
let fixtureAdmin, applicationPool, q, one, transferFromCompanyWallet, creditWalletOnce, debitWalletOnce, createWalletForAccount;
let ownsFixtureSchema = false;
const integration = (name, run) => test(name, { skip: !database ? "OBLIGON_TEST_DATABASE_URL local opt-in required" : false }, run);
const fixtureSchema = `money_${process.pid}_${randomUUID().replaceAll("-", "")}`;
test.before(async () => {
  if (!database) return;
  const target = new URL(database);
  assert.ok(["postgres:", "postgresql:"].includes(target.protocol), "An explicit PostgreSQL test URL is required");
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(target.hostname), "Only an explicit local test database is permitted");
  fixtureAdmin = new pg.Pool({ connectionString: database });
  await fixtureAdmin.query(`CREATE SCHEMA ${fixtureSchema}`);
  ownsFixtureSchema = true;
  for (const table of ["users", "organizations", "memberships", "wallets", "wallet_ledger", "idempotency_keys", "audit_logs", "notifications", "card_plans", "card_requests", "plan_wallet_credits"]) {
    await fixtureAdmin.query(`CREATE TABLE ${fixtureSchema}.${table} (LIKE public.${table} INCLUDING ALL)`);
  }
  await fixtureAdmin.query(`INSERT INTO ${fixtureSchema}.card_plans(code,name,amount_kobo,interval) VALUES('unit-plan','Synthetic Unit Plan',100000,'one-time')`);
  const isolated = new URL(database); isolated.searchParams.set("options", `-c search_path=${fixtureSchema}`);
  Object.assign(process.env, { DATABASE_URL: isolated.toString(), DATABASE_SSL: "false", DOTENV_CONFIG_PATH: "/dev/null", NODE_ENV: "test", EMAIL_PROVIDER: "local", SMS_PROVIDER: "local", LOCAL_OUTBOX_PATH: `/tmp/obligon-money-${fixtureSchema}.jsonl`, RESEND_API_KEY: "", TERMII_API_KEY: "", WEB_PUSH_VAPID_PRIVATE_KEY: "" });
  const db = await import("../src/db.js");
  ({ q, one } = db); applicationPool = db.getPool();
  ({ transferFromCompanyWallet, creditWalletOnce, debitWalletOnce } = await import("../src/lib/money.js"));
  ({ createWalletForAccount } = await import("../src/lib/wallets.js"));
});

async function seedOrg(label) {
  const email = `unit-${label}-${stamp}@example.com`;
  const user = await one(
    `INSERT INTO users (email, password_hash, full_name, role, status)
     VALUES ($1,'x',$2,'company','active') RETURNING id`,
    [email, `Unit ${label}`]
  );
  const org = await one(
    "INSERT INTO organizations (name, owner_user_id, type, verification_status) VALUES ($1,$2,'company','verified') RETURNING id",
    [`Unit ${label} ${stamp}`, user.id]
  );
  await q(
    "INSERT INTO memberships (organization_id, user_id, email, role, status) VALUES ($1,$2,$3,'owner','active')",
    [org.id, user.id, email]
  );
  const wallet = await createWalletForAccount({ userId: user.id, organizationId: org.id });
  return { user, org, wallet };
}

async function seedIndividual(label, organizationId = null) {
  const email = `unit-${label}-${stamp}@example.com`;
  const user = await one(
    `INSERT INTO users (email, password_hash, full_name, role, status)
     VALUES ($1,'x',$2,'customer','active') RETURNING id`,
    [email, `Unit ${label}`]
  );
  if (organizationId) {
    await q(
      "INSERT INTO memberships (organization_id, user_id, email, role, status) VALUES ($1,$2,$3,'viewer','active')",
      [organizationId, user.id, email]
    );
  }
  const wallet = await createWalletForAccount({ userId: user.id, organizationId: null });
  return { user, org: null, wallet };
}

/** Give a wallet a starting balance directly, bypassing payments. */
async function fund(walletId, kobo) {
  const w = await one("UPDATE wallets SET balance_kobo = $2 WHERE id = $1 RETURNING balance_kobo", [walletId, kobo]);
  return Number(w.balance_kobo);
}

async function balance(walletId) {
  const w = await one("SELECT balance_kobo FROM wallets WHERE id = $1", [walletId]);
  return Number(w.balance_kobo);
}

async function ledgerCount(walletId) {
  const r = await one("SELECT COUNT(*)::int AS n FROM wallet_ledger WHERE wallet_id = $1", [walletId]);
  return r.n;
}

// ---------------------------------------------------------------- crediting

integration("creditWalletOnce credits exactly once for the same idempotency key", async () => {
  const { wallet } = await seedIndividual("credit-once");
  const first = await creditWalletOnce({
    walletId: wallet.id,
    amountKobo: 50_000,
    idempotencyKey: `unit:credit-once:${stamp}`,
    description: "unit test"
  });
  assert.equal(first.credited, true);
  assert.equal(first.balanceKobo, 50_000);

  const second = await creditWalletOnce({
    walletId: wallet.id,
    amountKobo: 50_000,
    idempotencyKey: `unit:credit-once:${stamp}`,
    description: "unit test"
  });
  assert.equal(second.credited, false, "a replayed credit must be a no-op");
  assert.equal(second.balanceKobo, 50_000, "balance must not move twice");
  assert.equal(await balance(wallet.id), 50_000);
  assert.equal(await ledgerCount(wallet.id), 1, "only one ledger row per idempotency key");
});

integration("debitWalletOnce refuses to overdraw and never goes negative", async () => {
  const { wallet } = await seedIndividual("overdraw");
  await fund(wallet.id, 10_000);

  await assert.rejects(
    () => debitWalletOnce({ walletId: wallet.id, amountKobo: 10_001, idempotencyKey: `unit:over:${stamp}`, description: "too much" }),
    /Insufficient wallet balance/,
    "must not allow a balance to go negative"
  );
  assert.equal(await balance(wallet.id), 10_000, "a refused debit must leave the balance untouched");

  const ok = await debitWalletOnce({ walletId: wallet.id, amountKobo: 4_000, idempotencyKey: `unit:ok:${stamp}`, description: "affordable" });
  assert.equal(ok.debited, true);
  assert.equal(await balance(wallet.id), 6_000);
});

integration("debitWalletOnce is idempotent", async () => {
  const { wallet } = await seedIndividual("debit-once");
  await fund(wallet.id, 20_000);
  await debitWalletOnce({ walletId: wallet.id, amountKobo: 5_000, idempotencyKey: `unit:d-once:${stamp}`, description: "x" });
  const again = await debitWalletOnce({ walletId: wallet.id, amountKobo: 5_000, idempotencyKey: `unit:d-once:${stamp}`, description: "x" });
  assert.equal(again.debited, false);
  assert.equal(await balance(wallet.id), 15_000);
});

// ------------------------------------------------------- company transfer

integration("transferFromCompanyWallet moves funds atomically and writes both legs", async () => {
  const org = await seedOrg("xfer-ok");
  const member = await seedIndividual("xfer-member", org.org.id);
  await fund(org.wallet.id, 200_000);
  await fund(member.wallet.id, 1_000);

  const result = await transferFromCompanyWallet({
    organizationId: org.org.id,
    toUserId: member.user.id,
    amountKobo: 75_000,
    actorUserId: org.user.id,
    actorRole: "company",
    idempotencyKey: `unit:xfer-ok:${stamp}`
  });

  assert.equal(await balance(org.wallet.id), 125_000, "company wallet is debited");
  assert.equal(await balance(member.wallet.id), 76_000, "member wallet is credited");
  assert.equal(result.companyBalanceKobo, 125_000);
  assert.equal(result.memberBalanceKobo, 76_000);
  assert.ok(result.ref, "a reference is returned for support");

  const legs = await q(
    "SELECT direction, amount_kobo FROM wallet_ledger WHERE reference IN ($1,$2) ORDER BY direction",
    [`${result.ref}-OUT`, `${result.ref}-IN`]
  );
  assert.equal(legs.length, 2, "both legs are recorded");
});

integration("transferFromCompanyWallet refuses to overdraw the company wallet", async () => {
  const org = await seedOrg("xfer-over");
  const member = await seedIndividual("xfer-over-member", org.org.id);
  await fund(org.wallet.id, 5_000);
  await fund(member.wallet.id, 0);

  await assert.rejects(
    () => transferFromCompanyWallet({
      organizationId: org.org.id,
      toUserId: member.user.id,
      amountKobo: 5_001,
      actorUserId: org.user.id,
      actorRole: "company",
      idempotencyKey: `unit:xfer-over:${stamp}`
    }),
    /only has/i
  );
  assert.equal(await balance(org.wallet.id), 5_000, "no partial movement may occur");
  assert.equal(await balance(member.wallet.id), 0, "the member must not be credited on a failed transfer");
});

integration("transferFromCompanyWallet refuses non-positive amounts", async () => {
  const org = await seedOrg("xfer-zero");
  const member = await seedIndividual("xfer-zero-member", org.org.id);
  await fund(org.wallet.id, 100_000);
  for (const amount of [0, -5_000, Number.NaN]) {
    await assert.rejects(
      () => transferFromCompanyWallet({
        organizationId: org.org.id,
        toUserId: member.user.id,
        amountKobo: amount,
        actorUserId: org.user.id,
        actorRole: "company",
        idempotencyKey: `unit:xfer-invalid:${stamp}`
      }),
      /integer|range/i,
      `amount ${amount} must be rejected`
    );
  }
  assert.equal(await balance(org.wallet.id), 100_000);
  assert.equal(await balance(member.wallet.id), 0);
});

integration("a company cannot credit a user who is not its member", async () => {
  const org = await seedOrg("xfer-outsider");
  const outsider = await seedIndividual("xfer-outsider-user"); // no membership
  await fund(org.wallet.id, 100_000);
  await fund(outsider.wallet.id, 0);

  await assert.rejects(
    () => transferFromCompanyWallet({
      organizationId: org.org.id,
      toUserId: outsider.user.id,
      amountKobo: 10_000,
      actorUserId: org.user.id,
      actorRole: "company",
      idempotencyKey: `unit:xfer-outsider:${stamp}`
    }),
    /not an active member|member/i
  );
  assert.equal(await balance(outsider.wallet.id), 0, "an outsider's wallet must be untouched");
  assert.equal(await balance(org.wallet.id), 100_000);
});

integration("concurrent transfers cannot overdraw the company wallet", async () => {
  const org = await seedOrg("xfer-race");
  const members = [];
  for (let i = 0; i < 4; i += 1) members.push(await seedIndividual(`xfer-race-${i}`, org.org.id));
  await fund(org.wallet.id, 100_000);

  // Four concurrent 40,000 transfers against a 100,000 balance: at most two can
  // succeed. Without the FOR UPDATE lock this would happily overdraw.
  const outcomes = await Promise.allSettled(
    members.map((m) => transferFromCompanyWallet({
      organizationId: org.org.id,
      toUserId: m.user.id,
      amountKobo: 40_000,
      actorUserId: org.user.id,
      actorRole: "company",
      idempotencyKey: `unit:xfer-race:${stamp}:${m.user.id}`
    }))
  );
  const succeeded = outcomes.filter((o) => o.status === "fulfilled").length;
  const finalBalance = await balance(org.wallet.id);
  assert.ok(succeeded <= 2, `at most two transfers of 40k may succeed from 100k, got ${succeeded}`);
  assert.equal(finalBalance, 100_000 - succeeded * 40_000, "company balance must match the successful transfers");
  assert.ok(finalBalance >= 0, "the balance must never go negative");
  for (const m of members) {
    const b = await balance(m.wallet.id);
    assert.ok(b === 0 || b === 40_000, `member wallet should be 0 or 40000, got ${b}`);
  }
});

// ----------------------------------------------------- plan wallet crediting

integration("paying for a plan does NOT fund the fuel wallet", async () => {
  const { user } = await seedIndividual("plan-nowallet");
  const wallet = await one("SELECT * FROM wallets WHERE user_id = $1", [user.id]);
  const plan = await one("SELECT * FROM card_plans ORDER BY amount_kobo LIMIT 1");

  // charged_kobo is NOT NULL with no default on purpose: a default of zero would
  // silently mean "nothing is owed", so every insert has to state the figure.
  const request = await one(
    `INSERT INTO card_requests (user_id, plan_code, payment_provider, payment_reference, payment_status, status, fee_kobo, charged_kobo)
     VALUES ($1,$2,'flutterwave',$3,'paid','pending_verification',0,$4) RETURNING *`,
    [user.id, plan.code, `unit-plan-${stamp}`, Number(plan.amount_kobo)]
  );

  // A plan buys a card subscription. Crediting it to the wallet made
  // "Total Account Balance" read as the card price, which is money already spent
  // on a card rather than a spendable fuel balance.
  assert.equal(await balance(wallet.id), 0, "the wallet stays empty after a plan purchase");
  const after = await one("SELECT wallet_credited_at FROM card_requests WHERE id = $1", [request.id]);
  assert.equal(after.wallet_credited_at, null, "no wallet credit is recorded against the request");
  const credits = await q("SELECT COUNT(*)::int AS n FROM plan_wallet_credits WHERE card_request_id = $1", [request.id]);
  assert.equal(credits[0].n, 0, "no plan_wallet_credits row is created");

  // A top-up, by contrast, must still fund the wallet.
  const { credited, balanceKobo } = await creditWalletOnce({
    walletId: wallet.id,
    amountKobo: Number(plan.amount_kobo),
    idempotencyKey: `unit:topup-after-plan:${stamp}`,
    description: "unit test top-up"
  });
  assert.equal(credited, true, "a top-up still credits the wallet");
  assert.equal(balanceKobo, Number(plan.amount_kobo));
});

// ------------------------------------------------------------------ cleanup

test.after(async () => {
  if (!fixtureAdmin) return;
  try {
    await applicationPool?.end();
    if (ownsFixtureSchema) await fixtureAdmin.query(`DROP SCHEMA ${fixtureSchema} CASCADE`);
  } finally {
    await fixtureAdmin.end();
  }
});
