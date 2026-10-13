export function companyNaira(value: string): number {
  const text = value.trim();
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(text)) throw new Error('Enter a valid amount in naira.');
  const amount = Number(text.replaceAll(',', ''));
  if (!Number.isFinite(amount) || amount < 100 || amount > 1_000_000_000) throw new Error('Spend limits must be between ₦100 and ₦1,000,000,000.');
  return amount;
}
export function companyCardPayload(form: { label: string; vehicleId: string; driverId: string; dailyLimit: string; monthlyLimit: string }) {
  const dailyLimit = companyNaira(form.dailyLimit);
  const monthlyLimit = companyNaira(form.monthlyLimit);
  if (monthlyLimit < dailyLimit) throw new Error('Monthly limit cannot be lower than the daily limit.');
  return { label: form.label.trim(), vehicleId: form.vehicleId || undefined, driverId: form.driverId || undefined, dailyLimit, monthlyLimit };
}
export function companyExportQuery(input: { range: string; scope: string; vehicle?: string; driver?: string; driverId?: string; date?: string }) {
  const query = new URLSearchParams({ format: 'csv', range: input.range, scope: input.scope });
  if (input.scope === 'transactions') for (const key of ['vehicle', 'driver', 'driverId', 'date'] as const) if (input[key]) query.set(key, input[key]!);
  return query.toString();
}

export function companyAssignmentSelection(card: { id: string; vehicle_id?: string | null; driver_id?: string | null } | undefined, vehicleOverride?: string) {
  return { cardId: card?.id ?? '', vehicleId: vehicleOverride ?? card?.vehicle_id ?? '', driverId: card?.driver_id ?? '' };
}

type AssignedCard = { id: string; vehicle_id?: string | null; driver_id?: string | null };
export function companyAssignmentKnown(card: AssignedCard | undefined): boolean {
  return Boolean(card && Object.hasOwn(card, 'vehicle_id') && Object.hasOwn(card, 'driver_id') && card.vehicle_id !== undefined && card.driver_id !== undefined);
}
export function companyAssignmentPayload(card: AssignedCard | undefined, draft: { vehicleId: string; driverId: string }) {
  if (!card || !companyAssignmentKnown(card)) throw new Error('Card assignment details are unavailable. Reopen the form before saving.');
  return { cardId: card.id, vehicleId: draft.vehicleId || undefined, driverId: draft.driverId || undefined };
}
