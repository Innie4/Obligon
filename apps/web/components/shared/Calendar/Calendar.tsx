"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { calendarDateAllowed, calendarDateValue, parseCalendarDate, shiftCalendarDay, shiftCalendarMonth } from "@/lib/calendar-date";

interface CalendarProps {
  mode?: "month" | "range";
  selectedDates: Date[] | null;
  onDateSelect: (date: Date) => void;
  onRangeSelect?: (start: Date, end: Date) => void;
  disabledDates?: Date[];
  min?: string;
  max?: string;
  label?: string;
}
const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const weekdays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const focusClass = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obligon-green focus-visible:ring-offset-2";

export function Calendar({ mode = "month", selectedDates, onDateSelect, onRangeSelect, disabledDates = [], min, max, label = "Choose a date" }: CalendarProps) {
  const current = calendarDateValue(selectedDates?.[0] ?? new Date());
  const initial = parseCalendarDate(min && current < min ? min : max && current > max ? max : current)!;
  const [focused, setFocused] = React.useState(() => calendarDateValue(initial));
  const [month, setMonth] = React.useState(() => new Date(initial.getFullYear(), initial.getMonth(), 1, 12));
  const dayRefs = React.useRef(new Map<string, HTMLButtonElement>());
  const moveFocus = React.useRef(false);
  const id = React.useId();
  const blocked = new Set(disabledDates.map(calendarDateValue));
  const enabled = (value: string) => calendarDateAllowed(value, min, max) && !blocked.has(value);
  const selected = selectedDates?.map(calendarDateValue) ?? [];
  const today = calendarDateValue(new Date());
  const first = new Date(month.getFullYear(), month.getMonth(), 1, 12);
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0, 12);
  const slots = Math.ceil((first.getDay() + last.getDate()) / 7) * 7;
  const cells = Array.from({ length: slots }, (_, index) => {
    const day = index - first.getDay() + 1;
    return day > 0 && day <= last.getDate() ? new Date(month.getFullYear(), month.getMonth(), day, 12) : null;
  });
  const selectable = cells.filter((day): day is Date => Boolean(day && enabled(calendarDateValue(day))));
  const tabDate = selectable.some(day => calendarDateValue(day) === focused) ? focused : selectable[0] && calendarDateValue(selectable[0]);
  const startYear = min ? Number(min.slice(0, 4)) : Math.min(1900, month.getFullYear());
  const endYear = max ? Number(max.slice(0, 4)) : Math.max(new Date().getFullYear() + 10, month.getFullYear());
  const years = Array.from({ length: Math.max(0, endYear - startYear + 1) }, (_, index) => startYear + index);

  React.useEffect(() => {
    if (moveFocus.current) { dayRefs.current.get(focused)?.focus(); moveFocus.current = false; }
  }, [focused, month]);

  function select(date: Date) {
    const value = calendarDateValue(date);
    if (!enabled(value)) return;
    if (mode === "range" && selectedDates?.length === 1 && onRangeSelect) {
      const start = selectedDates[0];
      const low = calendarDateValue(start) < value ? calendarDateValue(start) : value;
      const high = calendarDateValue(start) > value ? calendarDateValue(start) : value;
      if ([...blocked].some(day => day >= low && day <= high)) return;
      onRangeSelect(start < date ? start : date, start < date ? date : start);
    } else onDateSelect(date);
  }
  function showMonth(next: Date) {
    if (min && calendarDateValue(new Date(next.getFullYear(), next.getMonth() + 1, 0, 12)) < min) return;
    if (max && calendarDateValue(new Date(next.getFullYear(), next.getMonth(), 1, 12)) > max) return;
    setMonth(new Date(next.getFullYear(), next.getMonth(), 1, 12));
  }
  function handleKey(event: React.KeyboardEvent<HTMLButtonElement>, date: Date) {
    let next: Date;
    switch (event.key) {
      case "ArrowLeft": next = shiftCalendarDay(date, -1); break;
      case "ArrowRight": next = shiftCalendarDay(date, 1); break;
      case "ArrowUp": next = shiftCalendarDay(date, -7); break;
      case "ArrowDown": next = shiftCalendarDay(date, 7); break;
      case "Home": next = shiftCalendarDay(date, -date.getDay()); break;
      case "End": next = shiftCalendarDay(date, 6 - date.getDay()); break;
      case "PageUp": next = shiftCalendarMonth(date, event.shiftKey ? -12 : -1); break;
      case "PageDown": next = shiftCalendarMonth(date, event.shiftKey ? 12 : 1); break;
      default: return;
    }
    event.preventDefault();
    const value = calendarDateValue(next);
    if (!enabled(value)) return;
    moveFocus.current = true; setFocused(value); showMonth(next);
  }

  return <div className="w-full min-w-0 rounded-2xl border border-obligon-border bg-white p-3 text-obligon-navy shadow-sm">
    <div className="mb-3 grid grid-cols-[2.25rem_minmax(0,1fr)_2.25rem] items-center gap-1">
      <button type="button" aria-label="Previous month" disabled={Boolean(min && calendarDateValue(shiftCalendarDay(first, -1)) < min)} onClick={() => showMonth(shiftCalendarMonth(month, -1))} className={`col-start-1 row-start-1 flex h-11 w-9 items-center justify-center rounded-lg hover:bg-obligon-mist disabled:opacity-30 ${focusClass}`}><ChevronLeft size={18} aria-hidden="true" /></button>
      <span aria-hidden="true" className="col-start-2 row-start-1 text-center text-sm font-bold">{months[month.getMonth()]} {month.getFullYear()}</span>
      <div className="col-span-3 row-start-2 grid min-w-0 grid-cols-[minmax(0,1fr)_5rem] gap-2">
        <select aria-label="Calendar month" value={month.getMonth()} onChange={event => showMonth(new Date(month.getFullYear(), Number(event.target.value), 1, 12))} className={`min-h-11 min-w-0 rounded-lg border border-obligon-border bg-white px-1 text-sm font-bold ${focusClass}`}>
          {months.map((name, index) => <option key={name} value={index} disabled={Boolean((min && calendarDateValue(new Date(month.getFullYear(), index + 1, 0, 12)) < min) || (max && calendarDateValue(new Date(month.getFullYear(), index, 1, 12)) > max))}>{name}</option>)}
        </select>
        <select aria-label="Calendar year" value={month.getFullYear()} onChange={event => {
          const year = Number(event.target.value);
          const next = new Date(year, month.getMonth(), 1, 12);
          if (min && calendarDateValue(new Date(year, next.getMonth() + 1, 0, 12)) < min) showMonth(parseCalendarDate(min)!);
          else if (max && calendarDateValue(next) > max) showMonth(parseCalendarDate(max)!);
          else showMonth(next);
        }} className={`min-h-11 min-w-0 rounded-lg border border-obligon-border bg-white px-1 text-sm font-bold ${focusClass}`}>{years.map(year => <option key={year} value={year}>{year}</option>)}</select>
      </div>
      <button type="button" aria-label="Next month" disabled={Boolean(max && calendarDateValue(shiftCalendarDay(last, 1)) > max)} onClick={() => showMonth(shiftCalendarMonth(month, 1))} className={`col-start-3 row-start-1 flex h-11 w-9 items-center justify-center rounded-lg hover:bg-obligon-mist disabled:opacity-30 ${focusClass}`}><ChevronRight size={18} aria-hidden="true" /></button>
    </div>
    <span id={`${id}-label`} className="sr-only">{label}</span>
    <p aria-live="polite" className="sr-only">{months[month.getMonth()]} {month.getFullYear()}</p>
    <div role="grid" aria-labelledby={`${id}-label`}>
      <div role="row" className="grid grid-cols-7">{weekdays.map(day => <span role="columnheader" key={day} className="pb-2 text-center text-xs font-bold text-obligon-text">{day}</span>)}</div>
      {Array.from({ length: slots / 7 }, (_, week) => <div role="row" key={week} className="grid grid-cols-7 gap-y-1">
        {cells.slice(week * 7, week * 7 + 7).map((day, index) => {
          const value = day && calendarDateValue(day);
          const active = Boolean(value && (selected.includes(value) || (mode === "range" && selected.length === 2 && value >= selected[0] && value <= selected[1])));
          return <div role="gridcell" key={value ?? `blank-${index}`} aria-selected={active} className="flex min-w-0 items-center justify-center">{day && value ? <button type="button" ref={node => { if (node) dayRefs.current.set(value, node); else dayRefs.current.delete(value); }} tabIndex={value === tabDate ? 0 : -1} disabled={!enabled(value)} aria-label={day.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} aria-current={value === today ? "date" : undefined} onFocus={() => setFocused(value)} onKeyDown={event => handleKey(event, day)} onClick={() => select(day)} className={`flex h-11 w-full max-w-11 items-center justify-center rounded-lg text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-30 ${active ? "bg-obligon-green text-white" : value === today ? "border border-obligon-green text-obligon-green hover:bg-obligon-mist" : "hover:bg-obligon-mist"} ${focusClass}`}>{day.getDate()}</button> : <span className="h-11" />}</div>;
        })}
      </div>)}
    </div>
    <p className="mt-3 border-t border-obligon-border pt-2 text-[11px] leading-4 text-obligon-text">Use arrow keys to move by day or week. Page Up and Page Down change the month.</p>
  </div>;
}
