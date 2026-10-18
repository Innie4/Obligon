"use client";

import * as React from "react";
import { CalendarDays, X } from "lucide-react";
import { Calendar } from "./Calendar";
import { calendarDateAllowed, calendarDateValue, localDateTimeValue, parseCalendarDate } from "@/lib/calendar-date";

interface DateFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  id?: string;
  name?: string;
  min?: string;
  max?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  labelClassName?: string;
  autoComplete?: string;
}
const control = "min-h-12 w-full min-w-0 rounded-xl border border-obligon-border bg-white px-3 text-sm font-medium text-obligon-navy outline-none focus:border-obligon-green focus:ring-2 focus:ring-obligon-green/15 disabled:opacity-50";

export function DateField({ label, value, onChange, id: suppliedId, name, min, max, required, disabled, className = "", labelClassName = "", autoComplete }: DateFieldProps) {
  const generatedId = React.useId();
  const id = suppliedId ?? generatedId;
  const [draft, setDraft] = React.useState(value);
  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState("");
  const root = React.useRef<HTMLDivElement>(null);
  const input = React.useRef<HTMLInputElement>(null);
  const trigger = React.useRef<HTMLButtonElement>(null);
  const panel = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => { setDraft(value); setError(""); }, [value]);
  React.useEffect(() => { if (disabled) setOpen(false); }, [disabled]);
  React.useEffect(() => {
    input.current?.setCustomValidity(draft && !calendarDateAllowed(draft, min, max) ? "Enter an available date in YYYY-MM-DD format." : "");
  }, [draft, min, max]);
  React.useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLButtonElement>('[role="gridcell"] button[tabindex="0"]')?.focus();
    const outside = (event: PointerEvent) => { if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false); };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  function change(raw: string) {
    setDraft(raw);
    const allowed = !raw || calendarDateAllowed(raw, min, max);
    setError(allowed ? "" : "Use YYYY-MM-DD and choose an available date.");
    if (allowed) onChange(raw);
  }
  const chosen = parseCalendarDate(value);
  return <div ref={root} className={`min-w-0 ${className}`} onBlur={event => { if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) setOpen(false); }} onKeyDown={event => { if (event.key === "Escape" && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus(); } }}>
    <label htmlFor={id} className={`mb-1.5 block text-xs font-bold text-obligon-text ${labelClassName}`}>{label}</label>
    <div className="flex min-w-0 items-stretch gap-2">
      <input ref={input} id={id} type="text" name={name} value={draft} onChange={event => change(event.target.value)} onInvalid={() => setError(draft ? "Choose an available date in YYYY-MM-DD format." : "Choose a date.")} pattern="[0-9]{4}-[0-9]{2}-[0-9]{2}" placeholder="YYYY-MM-DD" required={required} disabled={disabled} maxLength={10} autoComplete={autoComplete ?? "off"} aria-invalid={Boolean(error)} aria-describedby={`${id}-hint${error ? ` ${id}-error` : ""}`} className={control} />
      <button ref={trigger} type="button" disabled={disabled} aria-label={`Choose ${label.toLowerCase()}`} aria-expanded={open} aria-haspopup="dialog" aria-controls={`${id}-calendar`} onClick={() => setOpen(!open)} className="flex min-h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-obligon-border bg-obligon-mist text-obligon-green outline-none hover:border-obligon-green focus-visible:ring-2 focus-visible:ring-obligon-green focus-visible:ring-offset-2 disabled:opacity-50"><CalendarDays size={19} aria-hidden="true" /></button>
    </div>
    <span id={`${id}-hint`} className="sr-only">Enter year, month and day as YYYY-MM-DD, or open the calendar.{min ? ` Earliest date ${min}.` : ""}{max ? ` Latest date ${max}.` : ""}</span>
    {error ? <p id={`${id}-error`} role="alert" className="mt-1.5 text-xs text-red-700">{error}</p> : null}
    {open && !disabled ? <div ref={panel} id={`${id}-calendar`} role="dialog" aria-label={`${label} calendar`} className="mt-2 w-full max-w-sm">
      <div className="mb-1 flex justify-end"><button type="button" aria-label="Close calendar" onClick={() => { setOpen(false); trigger.current?.focus(); }} className="flex min-h-11 items-center gap-1 rounded-lg px-2 text-xs font-bold text-obligon-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obligon-green"><X size={14} aria-hidden="true" />Close</button></div>
      <Calendar key={`${min ?? ""}:${max ?? ""}`} label={label} selectedDates={chosen ? [chosen] : null} min={min} max={max} onDateSelect={date => { change(calendarDateValue(date)); setOpen(false); trigger.current?.focus(); }} />
    </div> : null}
  </div>;
}

export function DateTimeField({ label, value, onChange, name, required, disabled }: Pick<DateFieldProps, "label" | "value" | "onChange" | "name" | "required" | "disabled">) {
  const [date, setDate] = React.useState(value.slice(0, 10));
  const [time, setTime] = React.useState(value.slice(11, 16));
  const emitted = React.useRef(value);
  const timeId = React.useId();
  React.useEffect(() => {
    if (value === emitted.current) return;
    emitted.current = value;
    setDate(value.slice(0, 10)); setTime(value.slice(11, 16));
  }, [value]);
  function publish(nextDate: string, nextTime: string) {
    emitted.current = localDateTimeValue(nextDate, nextTime);
    onChange(emitted.current);
  }
  return <div role="group" aria-label={label} className="min-w-0 rounded-xl border border-obligon-border bg-obligon-mist/40 p-3">
    <DateField label={label} value={date} required={required} disabled={disabled} onChange={next => { setDate(next); publish(next, time); }} />
    <label htmlFor={timeId} className="mb-1.5 mt-3 block text-xs font-bold text-obligon-text">Time</label>
    <input id={timeId} type="time" step={60} value={time} required={required} disabled={disabled} onChange={event => { setTime(event.target.value); publish(date, event.target.value); }} className={control} />
    <input type="hidden" name={name} value={localDateTimeValue(date, time)} />
    <p className="mt-2 text-xs text-obligon-text">Uses your device&apos;s local time.</p>
  </div>;
}
