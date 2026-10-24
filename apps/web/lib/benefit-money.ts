/** Parse a UI amount without binary floating-point arithmetic. */
export function benefitAmountKobo(value: string, allowZero = false): number | null {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) return null;
  const minor = BigInt(match[1]) * BigInt(100) + BigInt((match[2] ?? "").padEnd(2, "0"));
  return (minor > BigInt(0) || (allowZero && minor === BigInt(0))) && minor <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(minor) : null;
}

export function benefitMoney(value: string | number): string {
  const minor = BigInt(value);
  const absolute = minor < BigInt(0) ? -minor : minor;
  return `${minor < BigInt(0) ? "-" : ""}₦${(absolute / BigInt(100)).toLocaleString("en-NG")}.${String(absolute % BigInt(100)).padStart(2, "0")}`;
}
