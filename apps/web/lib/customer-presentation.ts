import type { CustomerMoneyEvent } from "@/lib/services/types";

/** A receipt describes the recorded event; missing metadata stays missing. */
export function customerReceiptRows(event: CustomerMoneyEvent): Array<[string, string]> {
  const rows: Array<[string, string]> = [
    ["Record ID", event.id],
    ["Type", event.kind === "dispense" ? "Fuel purchase" : event.kind === "topup" ? "Wallet top-up" : "Wallet movement"],
    ["Status", event.status ? event.status.toUpperCase() : "UNKNOWN"],
    ["Amount", event.amount],
  ];
  if (event.reference) rows.push(["Reference", event.reference]);
  if (event.station) rows.push(["Merchant / Station", event.station]);
  if (event.kind === "dispense") {
    if (event.vehicle) rows.push(["Vehicle ID", event.vehicle]);
    if (event.fuel) rows.push(["Fuel Type", event.fuel]);
    if (event.maskedPan) rows.push(["Card Number", event.maskedPan]);
    if (event.litres != null) rows.push(["Volume", `${event.litres} L`]);
  } else if (event.subtitle) rows.push(["Description", event.subtitle]);
  if (event.time) rows.push(["Timestamp", event.time]);
  if (event.balanceAfterLabel) rows.push(["Balance After", event.balanceAfterLabel]);
  return rows;
}

export function customerReceiptText(event: CustomerMoneyEvent): string {
  return ["OBLIGON LTD TRANSACTION RECEIPT", "", ...customerReceiptRows(event).map(([label, value]) => `${label}: ${value}`)].join("\n");
}

export function customerCardPresentation(status?: string | null) {
  const normalized = String(status ?? "").trim().toLowerCase();
  return {
    label: normalized ? normalized.replaceAll("_", " ").toUpperCase() : "STATUS UNAVAILABLE",
    tone: normalized === "active" ? "green" : ["frozen", "pending"].includes(normalized) ? "amber" : ["blocked", "lost"].includes(normalized) ? "red" : "muted",
    canFreeze: ["active", "frozen"].includes(normalized),
    canChangePin: ["active", "frozen"].includes(normalized),
    canReportLost: ["active", "frozen"].includes(normalized),
    canReplace: ["active", "frozen", "blocked", "lost"].includes(normalized),
  };
}

export function customerWalletHint(balanceKobo?: number | null): string {
  if (balanceKobo == null) return "Check your balance before making a fuel payment.";
  return balanceKobo > 0
    ? "Your wallet is funded. Use My Card to authorize fuel purchases when your card and plan are active."
    : "Add funds to start paying for fuel.";
}

export function notificationPathForRole(role?: string | null): string | null {
  if (role === "customer") return "/customer/notifications";
  if (role === "company") return "/company/notifications";
  if (role === "partner" || role === "mechanic") return "/dashboard/notifications";
  // Admin has no notification screen; an unknown role has no safe destination.
  return null;
}
