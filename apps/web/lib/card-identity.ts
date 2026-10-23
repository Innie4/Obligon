export type CardIdentityDetails = {
  identityRevision?: string;
  fullName: string;
  bvn: string;
  address: string;
  city: string;
  state: string;
  dateOfBirth: string;
  postalCode: string;
  phone: string;
  identityConsent: boolean;
};

/** Keep the country prefix outside the editable national-number field. */
export function nationalPhone(value: string): string {
  const compact = value.trim().replace(/[\s()-]/g, "");
  return compact.startsWith("+234") ? compact.slice(4) : compact;
}

export function nigeriaIdentityPhone(value: string): string | null {
  const national = nationalPhone(value);
  const digits = /^0[789]\d{9}$/.test(national) ? national.slice(1) : national;
  return /^[789]\d{9}$/.test(digits) ? `+234${digits}` : null;
}

export function identityDetailsError(details: CardIdentityDetails): string | null {
  if (details.fullName.trim().split(/\s+/).length < 2 || details.fullName.trim().length > 120) return "Enter your full legal name as it appears on your BVN.";
  if (!/^2\d{10}$/.test(details.bvn)) return "Enter an 11-digit BVN starting with 2.";
  const dob = details.dateOfBirth;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob) || !Number.isFinite(Date.parse(dob)) || new Date(dob).toISOString().slice(0, 10) !== dob || new Date(dob) >= new Date()) return "Enter a valid date of birth.";
  if (!nigeriaIdentityPhone(details.phone)) return "Enter a Nigerian mobile number with 10 digits, or 11 digits starting with 0.";
  if (!details.address.trim() || details.address.trim().length > 200) return "Enter your residential address, up to 200 characters.";
  if (!details.state) return "Select your state first.";
  if (!details.city) return "Select your city or town.";
  if (details.postalCode && !/^\d{6}$/.test(details.postalCode)) return "Enter a six-digit postal code, or leave it blank.";
  if (!details.identityConsent) return "Confirm your consent to the identity and name checks.";
  return null;
}

export function safeBvnConsentUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    const allowed = url.hostname === "nibss-bvn-consent-management.myflutterwave.com";
    return url.protocol === "https:" && !url.username && !url.password && allowed ? url.href : null;
  } catch { return null; }
}

export function bvnStatusLabel(status?: string): string {
  const labels: Record<string, string> = {
    not_started: "Waiting for admin check", starting: "BVN check starting", pending_consent: "Identity consent needed",
    pending: "BVN result pending", matched: "BVN and name checks passed", mismatch: "Identity details need review",
    failed: "BVN check failed", unavailable: "BVN service unavailable", review_required: "Admin follow-up needed"
  };
  return labels[status ?? "not_started"] ?? "Admin follow-up needed";
}

export function canEditCardIdentity(request: { paymentStatus: string; status: string; issuanceState?: string; bvnStatus?: string }): boolean {
  return request.paymentStatus === "paid" && (request.issuanceState ?? "not_started") === "not_started" &&
    !["approved", "rejected", "cancelled", "withdrawn", "refunded"].includes(request.status) &&
    !["starting", "pending_consent", "pending", "review_required"].includes(request.bvnStatus ?? "not_started");
}
