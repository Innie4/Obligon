export type OpeningHoursValue = {
  mode: "unset" | "always" | "daily" | "legacy";
  opens: string;
  closes: string;
  legacy: string;
};

const validTime = (value: string) => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
const emptyHours = (): OpeningHoursValue => ({ mode: "unset", opens: "", closes: "", legacy: "" });

/** Recognize only unambiguous stored formats; never invent a replacement schedule. */
export function parseOpeningHours(raw: string | null): OpeningHoursValue {
  if (raw == null || !raw.trim()) return emptyHours();
  const text = raw.trim();
  if (/^(?:open\s*)?(?:24\s*\/\s*7|24\s*hours?)$/i.test(text)) {
    return { ...emptyHours(), mode: "always" };
  }
  const range = /^(\d{2}:\d{2})\s*[-–]\s*(\d{2}:\d{2})$/.exec(text);
  if (range && validTime(range[1]) && validTime(range[2]) && range[1] !== range[2]) {
    return { ...emptyHours(), mode: "daily", opens: range[1], closes: range[2] };
  }
  return { ...emptyHours(), mode: "legacy", legacy: raw };
}

export function openingHoursText(value: OpeningHoursValue): string {
  if (value.mode === "always") return "Open 24/7";
  if (value.mode === "daily") return `${value.opens} - ${value.closes}`;
  return value.mode === "legacy" ? value.legacy : "";
}

export function validateOpeningHours(value: OpeningHoursValue): string | null {
  if (value.mode === "daily") {
    if (!validTime(value.opens) || !validTime(value.closes)) return "Choose both an opening time and a closing time.";
    if (value.opens === value.closes) return "Choose different times, or select Open 24 hours.";
  }
  if (openingHoursText(value).length > 120) return "Opening hours must be 120 characters or fewer. Choose a new schedule.";
  return null;
}

const defaultFuels = ["PMS Petrol", "AGO Diesel", "DPK Kerosene", "LPG Gas", "CNG Compressed Gas"];
function fuelType(value: string): string {
  const name = value.trim().toLowerCase();
  if (/^(?:pms(?:\s+petrol)?|petrol|unleaded)$/.test(name)) return "petrol";
  if (/^(?:ago(?:\s+diesel)?|diesel)$/.test(name)) return "diesel";
  if (/^(?:dpk(?:\s+kerosene)?|kerosene)$/.test(name)) return "kerosene";
  if (/^(?:lpg(?:\s+gas)?|gas)$/.test(name)) return "lpg";
  if (/^(?:cng(?:\s+compressed\s+gas)?|compressed\s+(?:natural\s+)?gas)$/.test(name)) return "cng";
  return name;
}

/** Labels are also pricing keys. Prefer existing values without rewriting them. */
export function stationFuelOptions(value: string[], choices: string[] = []): string[] {
  const result = [...new Set(value)];
  const types = new Set(result.map(fuelType));
  for (const fuel of [...choices, ...defaultFuels]) {
    if (!fuel.trim() || types.has(fuelType(fuel))) continue;
    result.push(fuel);
    types.add(fuelType(fuel));
  }
  return result;
}
