"use client";

import * as React from "react";

type ToggleProps = {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  disabled?: boolean;
  /** Announced to screen readers and shown as helper copy. */
  label: string;
  description?: string;
  id?: string;
};

/**
 * Accessible switch used for preference rows.
 *
 * Rendered as a real `<button role="switch">` so it is reachable by keyboard
 * (Space/Enter), exposes `aria-checked`, and is announced correctly — unlike a
 * styled checkbox, which reads as "checked" rather than "on/off".
 */
export function Toggle({ checked, onCheckedChange, disabled, label, description, id }: ToggleProps) {
  const generatedId = React.useId();
  const switchId = id ?? generatedId;
  const describedBy = description ? `${switchId}-description` : undefined;

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <label htmlFor={switchId} className="block cursor-pointer text-xs font-bold text-obligon-navy">
          {label}
        </label>
        {description ? (
          <p id={describedBy} className="mt-1 text-[11px] leading-4 text-obligon-text">
            {description}
          </p>
        ) : null}
      </div>
      <button
        id={switchId}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={describedBy}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-obligon-green focus-visible:ring-offset-2 ${
          checked ? "bg-obligon-green" : "bg-[#cfd8cc]"
        } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
      >
        <span
          aria-hidden="true"
          className={`pointer-events-none inline-block size-5 transform rounded-full bg-white shadow ring-0 transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}
