import { badRequest, notFound } from './errors.js';
import { approvedDiscount, discountAmounts } from './discounts.js';
import { applyLedgerEntry } from './money.js';
import { requireCustomerPlan } from './subscriptions.js';
import { businessTimeZone } from './time.js';

export async function authorizeWalletFuelSale(t,{partnerOrgId,stationId,code,litres,fuelType,reference}) {
 const card=await t.one(`SELECT * FROM cards WHERE pos_code=$1 AND pos_code_expires_at>now() FOR UPDATE`,[code]);
 if(!card || card.status!=='active') throw badRequest('Invalid, expired, or inactive card authorization code');
 if(!card.organization_id) await requireCustomerPlan(card.owner_user_id,null,t);
 const station=await t.one('SELECT * FROM stations WHERE id=$1 AND partner_org_id=$2',[stationId,partnerOrgId]);
 if(!station) throw notFound('Station not found');
 const bank=await t.one('SELECT id FROM bank_accounts WHERE organization_id=$1 AND verified=TRUE AND is_default=TRUE',[partnerOrgId]);
 if(!bank) throw badRequest('A verified default settlement bank account is required before accepting fuel payments');
 const price=await t.one('SELECT * FROM fuel_prices WHERE station_id=$1 AND fuel_type=$2 FOR SHARE',[stationId,fuelType]);
 if(!price) throw badRequest('No published price for this station and fuel');
 const discount=await approvedDiscount(stationId,fuelType,t);
 const amounts=discountAmounts(Math.round(Number(price.price_kobo)*litres),discount?.rate_bp??0);
 const spent=await t.one(`SELECT COALESCE(SUM(amount_kobo) FILTER(WHERE created_at>=date_trunc('day',now() AT TIME ZONE $2) AT TIME ZONE $2),0) AS today,
 COALESCE(SUM(amount_kobo),0) AS month FROM (
 SELECT amount_kobo,created_at FROM transactions WHERE card_id=$1 AND status IN('success','pending')
 UNION ALL SELECT amount_kobo,created_at FROM fuel_orders WHERE card_id=$1 AND status='awaiting_payment' AND reservation_expires_at>now()
 ) spend WHERE created_at>=date_trunc('month',now() AT TIME ZONE $2) AT TIME ZONE $2`,[card.id,businessTimeZone()]);
 if(amounts.chargedKobo+Number(spent.today)>Number(card.daily_limit_kobo)||amounts.chargedKobo+Number(spent.month)>Number(card.monthly_limit_kobo)) throw badRequest('Fuel purchase exceeds the card daily or monthly limit');
 const wallet=card.organization_id ? await t.one('SELECT id,budget_limit_kobo FROM wallets WHERE organization_id=$1 FOR UPDATE',[card.organization_id]) :
   await t.one('SELECT id,budget_limit_kobo FROM wallets WHERE user_id=$1 AND organization_id IS NULL FOR UPDATE',[card.owner_user_id]);
 if(!wallet) throw badRequest('No fuel wallet is linked to this card');
 const walletSpend=await t.one(`SELECT COALESCE(SUM(amount_kobo),0) AS total FROM wallet_ledger WHERE wallet_id=$1 AND direction='debit'
  AND reference LIKE 'TXN-%' AND created_at>=date_trunc('month',now() AT TIME ZONE $2) AT TIME ZONE $2`,[wallet.id,businessTimeZone()]);
 if(Number(wallet.budget_limit_kobo)>0 && Number(walletSpend.total)+amounts.chargedKobo>Number(wallet.budget_limit_kobo)) throw badRequest('Fuel purchase exceeds the wallet monthly budget');
 await applyLedgerEntry(t,{walletId:wallet.id,direction:'debit',amountKobo:amounts.chargedKobo,reference,idempotencyKey:`fuel:${reference}`,description:`Fuel purchase at ${station.name}`});
 const sale=await t.one(`INSERT INTO transactions(reference,customer_user_id,organization_id,station_id,vehicle_id,driver_id,card_id,fuel_type,litres,
 amount_kobo,base_amount_kobo,platform_fee_kobo,partner_net_kobo,discount_request_id,settlement_method,status,meta)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'wallet_transfer','success','POS single-use code') RETURNING *`,
 [reference,card.owner_user_id,card.organization_id,station.id,card.vehicle_id,card.driver_id,card.id,fuelType,litres,amounts.chargedKobo,amounts.baseKobo,amounts.platformFeeKobo,amounts.partnerNetKobo,discount?.id??null]);
 await t.query('INSERT INTO fueling_logs(station_id,transaction_id,fuel_type,litres) VALUES($1,$2,$3,$4)',[station.id,sale.id,fuelType,litres]);
 await t.query(`UPDATE cards SET pos_code=NULL,pos_code_expires_at=NULL,spend_today_kobo=$2,spend_month_kobo=$3,updated_at=now() WHERE id=$1`,
 [card.id,Number(spent.today)+amounts.chargedKobo,Number(spent.month)+amounts.chargedKobo]);
 return {sale,card,amounts};
}
