"use client";

import * as React from "react";
import { ChevronDown, Clock3, Fuel } from "lucide-react";
import { stationFuelOptions, validateOpeningHours, type OpeningHoursValue } from "@/lib/station-profile-fields";

const controlFocus = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-obligon-green";

export function FuelMultiSelect({ value, onChange, choices = [], disabled = false }: {
  value: string[];
  onChange: (value: string[]) => void;
  choices?: string[];
  disabled?: boolean;
}) {
  const id = React.useId();
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const options = stationFuelOptions(value, choices);

  React.useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);
  React.useEffect(() => {
    if (!open) return;
    function outside(event: PointerEvent) {
      if (event.target instanceof Node && !containerRef.current?.contains(event.target)) setOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative min-w-0" onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
    }}>
      <label id={`${id}-label`} className="mb-2 block text-xs font-extrabold uppercase tracking-wide text-obligon-text" htmlFor={`${id}-trigger`}>Fuels available</label>
      <div className="relative">
      <button
        ref={buttonRef}
        id={`${id}-trigger`}
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-labelledby={`${id}-label ${id}-selection`}
        aria-controls={open ? `${id}-choices` : undefined}
        aria-describedby={`${id}-hint`}
        onClick={() => setOpen(current => !current)}
        className={`flex min-h-12 w-full items-center gap-3 rounded-xl border border-obligon-border bg-white px-4 py-3 text-left text-sm font-semibold text-obligon-navy disabled:cursor-not-allowed disabled:opacity-60 ${controlFocus}`}
      >
        <Fuel size={18} aria-hidden="true" className="shrink-0 text-obligon-green" />
        <span id={`${id}-selection`} className="min-w-0 flex-1">{value.length ? `${value.length} fuel ${value.length === 1 ? "type" : "types"} selected` : "Choose fuel types"}</span>
        <ChevronDown size={18} aria-hidden="true" className={`shrink-0 ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <fieldset id={`${id}-choices`} aria-labelledby={`${id}-label`} className="absolute inset-x-0 top-[calc(100%+8px)] z-20 m-0 max-h-64 min-w-0 overflow-y-auto overscroll-contain rounded-xl border border-obligon-border bg-white p-2 shadow-lg">
          {options.map(fuel => (
            <label key={fuel} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-obligon-navy hover:bg-obligon-mist focus-within:bg-obligon-mist">
              <input
                type="checkbox"
                value={fuel}
                checked={value.includes(fuel)}
                disabled={disabled}
                onChange={event => onChange(event.target.checked ? value.includes(fuel) ? value : [...value, fuel] : value.filter(selected => selected !== fuel))}
                className={`size-4 shrink-0 accent-obligon-green ${controlFocus}`}
              />
              <span className="min-w-0 break-words">{fuel}</span>
            </label>
          ))}
        </fieldset>
      ) : null}
      </div>
      {value.length ? (
        <ul className="mt-2 flex flex-wrap gap-2" aria-label="Selected fuel types">
          {value.map((fuel, index) => <li key={`${fuel}-${index}`} className="max-w-full break-words rounded-md border border-obligon-border bg-obligon-mist px-2.5 py-1 text-xs font-semibold text-obligon-navy">{fuel}</li>)}
        </ul>
      ) : null}
      <p id={`${id}-hint`} className="mt-2 text-xs leading-5 text-obligon-text">Select every fuel type offered at this station.</p>
    </div>
  );
}

function clockLabel(time: string): string {
  const [hour, minute] = time.split(":").map(Number);
  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`;
}

export function OpeningHoursField({ value, onChange, disabled = false }: {
  value: OpeningHoursValue;
  onChange: (value: OpeningHoursValue) => void;
  disabled?: boolean;
}) {
  const id = React.useId();
  const [editingLegacy, setEditingLegacy] = React.useState(false);
  const error = validateOpeningHours(value);
  const dailyValid = value.mode === "daily" && !error;
  const overnight = dailyValid && value.closes < value.opens;
  const choices = [{ mode: "unset", label: "Not set" }, { mode: "always", label: "Open 24 hours" }, { mode: "daily", label: "Daily hours" }] as const;

  return (
    <fieldset className="min-w-0 rounded-xl border border-obligon-border bg-white p-4" aria-describedby={`${id}-summary`}>
      <legend className="flex items-center gap-2 px-1 text-xs font-extrabold uppercase tracking-wide text-obligon-text"><Clock3 size={16} aria-hidden="true" />Opening hours</legend>
      {value.mode === "legacy" ? (
        <div className="mb-3 rounded-lg bg-obligon-mist p-3">
          <p className="text-xs font-semibold text-obligon-text">Current opening hours</p>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm font-semibold text-obligon-navy">{value.legacy}</p>
          <button type="button" disabled={disabled} onClick={() => setEditingLegacy(current => !current)} className={`mt-2 min-h-11 rounded-lg px-2 text-sm font-bold text-obligon-green disabled:opacity-60 ${controlFocus}`}>
            {editingLegacy ? "Keep existing hours" : "Change hours"}
          </button>
        </div>
      ) : null}
      {value.mode !== "legacy" || editingLegacy ? (
        <div className="grid gap-2 sm:grid-cols-3">
          {choices.map(choice => (
            <label key={choice.mode} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-obligon-green ${value.mode === choice.mode ? "border-obligon-green bg-obligon-mist text-obligon-green" : "border-obligon-border text-obligon-navy"} ${disabled ? "cursor-not-allowed opacity-60" : ""}`}>
              <input type="radio" name={`${id}-mode`} value={choice.mode} checked={value.mode === choice.mode} disabled={disabled} onChange={() => onChange({ ...value, mode: choice.mode, legacy: "" })} className="size-4 shrink-0 accent-obligon-green" />
              {choice.label}
            </label>
          ))}
        </div>
      ) : null}
      {value.mode === "daily" ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {([{ key: "opens", label: "Opens at" }, { key: "closes", label: "Closes at" }] as const).map(field => (
            <label key={field.key} className="min-w-0 text-xs font-bold text-obligon-text">
              {field.label}
              <input type="time" step={60} value={value[field.key]} disabled={disabled} onChange={event => onChange({ ...value, [field.key]: event.target.value })} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : `${id}-summary`} className={`mt-2 block min-h-12 w-full min-w-0 rounded-lg border border-obligon-border bg-white px-2 py-2 text-sm font-semibold text-obligon-navy disabled:opacity-60 sm:px-3 ${controlFocus}`} />
            </label>
          ))}
        </div>
      ) : null}
      <p id={`${id}-summary`} className="mt-3 text-xs leading-5 text-obligon-text">
        {value.mode === "always" ? "Open 24 hours, every day." : dailyValid ? `${clockLabel(value.opens)} – ${clockLabel(value.closes)}. ${overnight ? "Closes the next day." : "Same-day closing."}` : value.mode === "legacy" ? "Your existing hours will stay unchanged unless you choose a new schedule." : value.mode === "unset" ? "Opening hours have not been set." : "Choose the station’s daily opening and closing times."}
      </p>
      {error ? <p id={`${id}-error`} role="alert" className="mt-2 text-xs font-semibold text-[#9f1027]">{error}</p> : null}
    </fieldset>
  );
}
