/** Date-only values stay in the user's local calendar, never through UTC parsing. */
export function parseCalendarDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1) return null;
  const result = new Date(0);
  result.setFullYear(year, month - 1, day);
  result.setHours(12, 0, 0, 0);
  return result.getFullYear() === year && result.getMonth() === month - 1 && result.getDate() === day ? result : null;
}

export function calendarDateValue(date: Date): string {
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function shiftCalendarMonth(date: Date, amount: number): Date {
  const result = new Date(date);
  result.setDate(1);
  result.setMonth(result.getMonth() + amount);
  const last = new Date(result);
  last.setMonth(last.getMonth() + 1, 0);
  result.setDate(Math.min(date.getDate(), last.getDate()));
  return result;
}

export function shiftCalendarDay(date: Date, amount: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

export function calendarDateAllowed(value: string, min?: string, max?: string): boolean {
  return Boolean(parseCalendarDate(value)) && (!min || value >= min) && (!max || value <= max);
}

export function localDateTimeValue(date: string, time: string): string {
  return parseCalendarDate(date) && /^([01]\d|2[0-3]):[0-5]\d$/.test(time) ? `${date}T${time}` : '';
}
