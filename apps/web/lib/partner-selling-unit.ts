import { fuelSellingUnits, type SellingUnit } from "../../../packages/shared/partner-access.mjs";

/** Legacy liquid prices have one unit; never guess a gas station's approval. */
export function priceSellingUnit(fuel: string, unit?: SellingUnit): SellingUnit | undefined {
  const allowed = fuelSellingUnits(fuel);
  return unit && allowed.includes(unit) ? unit : !unit && allowed.length === 1 ? allowed[0] : undefined;
}
