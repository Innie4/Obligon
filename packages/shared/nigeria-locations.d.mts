export const NIGERIA_LOCATIONS: Readonly<Record<string, readonly string[]>>;
export const NIGERIA_STATES: readonly string[];
export function isNigeriaLocation(state: unknown, localGovernmentArea: unknown): boolean;
export function nigeriaLocationLabel(state: unknown, localGovernmentArea: unknown): string | null;
