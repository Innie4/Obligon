export interface CustomerEntitlementState {
  active: boolean;
  subscription?: { name?: string; plan_code?: string; is_free?: boolean; current_period_end?: string | null } | null;
  features?: Array<{ label?: string; name?: string; state?: string; included?: boolean; value?: string | boolean }>;
}
/** Rendering gate only; the API independently enforces the same catalogue. */
function isExplicitlyExcluded(value: unknown): boolean {
  if (value === false) return true;
  if (typeof value !== 'string') return false;
  const normalized = value.trim().toLowerCase();
  return ['unavailable', 'not included', 'false', '-'].includes(normalized) || (normalized.length === 1 && normalized.charCodeAt(0) === 8212);
}

export function customerFeatureAvailable(subscription: CustomerEntitlementState | null | undefined, label: string): boolean {
  if (!subscription?.active) return false;
  const feature = subscription.features?.find(f => (f.label ?? f.name ?? '').toLowerCase() === label.toLowerCase());
  if (!feature || [feature.state, feature.value, feature.included].some(isExplicitlyExcluded)) return false;
  const value = feature.state ?? feature.value ?? feature.included;
  return value === true || (typeof value === 'string' && value.trim() !== '' && !isExplicitlyExcluded(value));
}

export function customerAccountLabel(subscription: CustomerEntitlementState | null | undefined): string {
  if (!subscription?.active || subscription.subscription?.is_free || subscription.subscription?.plan_code === 'free') return 'Free plan';
  return `${subscription.subscription?.name ?? subscription.subscription?.plan_code ?? 'Active'} plan`;
}
