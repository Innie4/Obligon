export type CashbackIntent = { amountKobo: number; idempotencyKey: string };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function cashbackIntentKey(accountId: string) { return `obligon_cashback_intent:${accountId}`; }
export function readCashbackIntent(storage: Pick<Storage, "getItem">, accountId: string): CashbackIntent | null {
  const value = storage.getItem(cashbackIntentKey(accountId));
  if (!value) return null;
  const intent = JSON.parse(value) as CashbackIntent;
  if (!Number.isSafeInteger(intent.amountKobo) || intent.amountKobo <= 0 || !uuid.test(intent.idempotencyKey)) throw new Error("The pending cashback request needs review before another redemption.");
  return intent;
}
export function saveCashbackIntent(storage: Pick<Storage, "setItem">, accountId: string, intent: CashbackIntent) {
  storage.setItem(cashbackIntentKey(accountId), JSON.stringify(intent));
}
export function clearCashbackIntent(storage: Pick<Storage, "removeItem">, accountId: string) {
  storage.removeItem(cashbackIntentKey(accountId));
}
