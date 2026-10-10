export type CustomerPaymentFlow = "subscription" | "fuel";
export type CustomerReturnParams = Record<string, string | string[] | undefined>;

/** Keep old bookmarks and in-flight provider returns usable after moving to My Card. */
export function customerCardDestination(params: CustomerReturnParams, flow: CustomerPaymentFlow): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) value.forEach(item => query.append(key, item));
    else if (value !== undefined) query.set(key, value);
  }
  if (query.has("reference")) query.set("paymentFlow", flow);
  const search = query.toString();
  return `/customer/card${search ? `?${search}` : ""}`;
}

/** Embedded payment panels must only confirm their own processor return. */
export function customerPaymentReference(search: string, flow: CustomerPaymentFlow): string | null {
  const params = new URLSearchParams(search);
  return params.get("paymentFlow") === flow ? params.get("reference") : null;
}
