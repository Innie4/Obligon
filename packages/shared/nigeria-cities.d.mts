export const NIGERIA_CITIES: Readonly<Record<string, readonly string[]>>;
export function isNigeriaCity(state: unknown, city: unknown): boolean;
export function nigeriaCityLabel(state: unknown, city: unknown): string | null;
export function parseNigeriaCityLabel(value: unknown): { state: string; city: string } | null;
