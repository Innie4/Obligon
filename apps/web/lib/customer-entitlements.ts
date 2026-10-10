export interface CustomerEntitlementState {
  active: boolean;
  subscription?: { name?: string; plan_code?: string } | null;
  features?: Array<{ label?: string; name?: string; state?: string; included?: boolean; value?: string | boolean }>;
}
/** Rendering gate only; the API independently enforces the same paid catalogue. */
export function customerFeatureAvailable(subscription: CustomerEntitlementState | null | undefined, label: string): boolean {
  if (!subscription?.active) return false;
  const feature = subscription.features?.find(f => (f.label ?? f.name ?? '').toLowerCase() === label.toLowerCase());
  return Boolean(feature && feature.state !== 'unavailable' && feature.included !== false && ![false, '—', 'Not included'].includes(feature.value ?? 'included'));
}

export function customerAccountLabel(subscription: CustomerEntitlementState | null | undefined): string {
  if (!subscription?.active) return 'Free account';
  return `${subscription.subscription?.name ?? subscription.subscription?.plan_code ?? 'Active'} plan`;
}
