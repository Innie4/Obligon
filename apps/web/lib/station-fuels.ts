/** Treat the catalog's product codes and partner-entered names as the same fuel. */
export function stationFuelName(value: string): string {
  const name = value.trim();
  if (/^(pms(?:\s+petrol)?|petrol|unleaded)$/i.test(name)) return "Petrol";
  if (/^(ago(?:\s+diesel)?|diesel)$/i.test(name)) return "Diesel";
  if (/^(lpg(?:\s+gas)?|gas)$/i.test(name)) return "LPG";
  return name;
}
