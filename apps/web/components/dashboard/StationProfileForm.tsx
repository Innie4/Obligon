"use client";

import { StatusPopup } from "@/components/shared/StatusPopup";
import * as React from "react";
import { Loader2, MapPin, Save } from "lucide-react";
import type { PartnerStation } from "@/lib/services/types";
import { NIGERIA_CITIES } from "../../../../packages/shared/nigeria-cities.mjs";
import { NIGERIA_STATES } from "../../../../packages/shared/nigeria-locations.mjs";
import { stationProfileDraft, stationProfileErrors, stationProfileSubmission, type StationProfileDraft, type StationProfileErrors, type StationProfileSubmission } from "@/lib/station-profile";
import { FuelMultiSelect, OpeningHoursField } from "./StationProfileFields";
import { StationLocationPicker } from "./StationLocationPicker";
import { useSession } from "@/components/shared/AuthContext";
import { partnerAllowedFuels, partnerFuelCode, fuelSellingUnits, sellingUnitLabel, type SellingUnit } from "../../../../packages/shared/partner-access.mjs";

type Props = {
  station: PartnerStation["station"];
  creating: boolean;
  saving: boolean;
  fuelChoices?: string[];
  onSubmit: (payload: StationProfileSubmission) => Promise<void>;
  onCancel: () => void;
};
const fieldClass = "mt-2 min-h-12 w-full min-w-0 rounded-xl border border-obligon-border bg-white px-3 py-3 text-sm font-semibold text-obligon-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-obligon-green disabled:bg-obligon-mist disabled:text-obligon-text";
const labelClass = "block text-sm font-bold text-obligon-navy";

/** A keyed draft: changing stations unmounts this editor and any pending GPS request. */
export function StationProfileForm({ station, creating, saving, fuelChoices, onSubmit, onCancel }: Props) {
  const { user } = useSession();
  const canEdit = ["owner", "admin"].includes(user?.organizationRole ?? "");
  const allowedFuels = partnerAllowedFuels(user);
  const [draft, setDraft] = React.useState<StationProfileDraft>(() => stationProfileDraft(station));
  const [errors, setErrors] = React.useState<StationProfileErrors>({});
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [cityQuery, setCityQuery] = React.useState("");
  const cities = Object.hasOwn(NIGERIA_CITIES, draft.state) ? NIGERIA_CITIES[draft.state] : [];
  const matchingCities = cityQuery.trim() ? cities.filter(city => city.toLocaleLowerCase("en").includes(cityQuery.trim().toLocaleLowerCase("en"))) : cities;
  // Searching must not silently remove an already selected city from the native select.
  const cityOptions = draft.city && !matchingCities.includes(draft.city) ? [draft.city, ...matchingCities] : matchingCities;
  const baseline = React.useMemo(() => stationProfileDraft(station), [station]);
  const legacyCity = station?.city && !baseline.state ? station.city : null;

  function change<K extends keyof StationProfileDraft>(key: K, value: StationProfileDraft[K]) {
    if (saving || !canEdit) return;
    setDraft(current => ({ ...current, [key]: value, ...(key === "state" ? { city: "" } : {}) }));
    setErrors(current => ({ ...current, [key]: undefined, ...(key === "state" ? { city: undefined } : {}) }));
    setServerError(null);
    if (key === "state") setCityQuery("");
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !canEdit) return;
    const issues = stationProfileErrors(draft, station);
    if (draft.fuels.some(fuel => !allowedFuels.includes(partnerFuelCode(fuel)!))) issues.fuels = "Choose fuels supported by your approved partner type.";
    setErrors(issues);
    if (Object.keys(issues).length) return;
    try {
      await onSubmit(stationProfileSubmission(draft, station));
      setServerError(null);
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "The station could not be saved. Please try again.");
    }
  }
  const errorMessage = (key: keyof StationProfileDraft) => errors[key] ? <p id={`station-${key}-error`} className="mt-2 text-sm font-medium text-[#9f1027]" role="alert">{errors[key]}</p> : null;

  return (
    <form onSubmit={submit} noValidate className="min-w-0 rounded-xl border border-obligon-border bg-white p-5 sm:p-7">
      <div className="mb-6 flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-obligon-mist text-obligon-green"><MapPin size={22} aria-hidden="true" /></span>
        <div><h2 className="font-display text-lg font-bold tracking-tight sm:text-xl text-obligon-navy">{creating ? "Add a fuel station" : "Location details"}</h2><p className="mt-1 text-sm text-obligon-text">Keep your station’s customer-facing details accurate.</p></div>
      </div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-obligon-border pb-5">
        <nav aria-label="Station profile sections" className="flex flex-wrap gap-2">
          {[["station-details", "Details"], ["station-fuels", "Fuels & units"], ["station-hours", "Hours"], ["station-position", "Location"]].map(([id, label]) => <a key={id} href={`#${id}`} className="inline-flex min-h-11 items-center rounded-xl border border-obligon-border px-3 text-sm font-semibold text-obligon-green">{label}</a>)}
        </nav>
        {canEdit ? <button type="submit" disabled={saving} className="min-h-12 rounded-xl bg-obligon-green px-5 text-sm font-bold text-white disabled:opacity-50">{saving ? "Saving…" : creating ? "Submit for approval" : "Save profile"}</button> : null}
      </div>
      {serverError ? <StatusPopup tone="error" message={serverError} /> : null}
      {!canEdit ? <p className="mb-5 text-sm text-obligon-text">You can view this profile. An owner or administrator can update it.</p> : null}
      <fieldset disabled={saving || !canEdit} className="min-w-0 space-y-6">
        <legend className="sr-only">Station profile</legend>
        <div id="station-details" tabIndex={-1} className="scroll-mt-28 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-obligon-green">
          <label htmlFor="station-name" className={labelClass}>Station brand &amp; name</label>
          <input id="station-name" value={draft.name} onChange={event => change("name", event.target.value)} maxLength={200} autoComplete="organization" required aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? "station-name-error" : undefined} className={fieldClass} />
          {errorMessage("name")}
        </div>
        <div>
          <label htmlFor="station-address" className={labelClass}>Physical address</label>
          <input id="station-address" value={draft.address} onChange={event => change("address", event.target.value)} maxLength={500} autoComplete="street-address" required aria-invalid={Boolean(errors.address)} aria-describedby={errors.address ? "station-address-error" : undefined} className={fieldClass} />
          {errorMessage("address")}
        </div>
        {legacyCity ? <p className="rounded-xl bg-obligon-mist p-3 text-sm text-obligon-text">Recorded location: <strong>{legacyCity}</strong>. It will be kept until you choose a State / FCT and city below.</p> : null}
        <div className="grid min-w-0 gap-5 sm:grid-cols-2">
          <div className="min-w-0">
            <label htmlFor="station-state" className={labelClass}>State / FCT</label>
            <select id="station-state" value={draft.state} onChange={event => change("state", event.target.value)} autoComplete="address-level1" aria-invalid={Boolean(errors.state)} aria-describedby={errors.state ? "station-state-error" : undefined} className={fieldClass}>
              <option value="">Choose State / FCT</option>
              {NIGERIA_STATES.map(state => <option key={state} value={state}>{state === "Federal Capital Territory" ? "Federal Capital Territory (FCT)" : state}</option>)}
            </select>
            {errorMessage("state")}
          </div>
          <div className="min-w-0">
            <label htmlFor="station-city" className={labelClass}>City / town</label>
            <select id="station-city" value={draft.city} onChange={event => change("city", event.target.value)} disabled={!draft.state || saving || !canEdit} autoComplete="address-level2" aria-invalid={Boolean(errors.city)} aria-describedby={`station-city-hint${errors.city ? " station-city-error" : ""}`} className={fieldClass}>
              <option value="">{draft.state ? "Choose city / town" : "Choose a State / FCT first"}</option>
              {cityOptions.map(city => <option key={city} value={city}>{city}</option>)}
            </select>
            {errorMessage("city")}
          </div>
        </div>
        {draft.state ? <div>
          <label htmlFor="station-city-search" className={labelClass}>Find a city / town <span className="font-normal text-obligon-text">(optional)</span></label>
          <input id="station-city-search" type="search" value={cityQuery} onChange={event => setCityQuery(event.target.value)} placeholder="Type to filter the city dropdown" className={fieldClass} />
          <p id="station-city-hint" className="mt-2 text-xs text-obligon-text">{matchingCities.length ? `${matchingCities.length.toLocaleString("en-NG")} matching place names in ${draft.state}.` : "No matching place names. Try another spelling or clear the search."} Select a location from the dropdown above.</p>
        </div> : <p id="station-city-hint" className="text-sm text-obligon-text">Choose a State / FCT to see its cities and towns.</p>}
        <p className="text-xs text-obligon-text">Place names: <a href="https://www.geonames.org/" target="_blank" rel="noreferrer" className="underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-obligon-green">GeoNames</a> · Cities, towns and populated localities, under <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer" className="underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-obligon-green">CC BY 4.0</a>.</p>
        <div id="station-fuels" tabIndex={-1} className="scroll-mt-28 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-obligon-green"><FuelMultiSelect value={draft.fuels} onChange={value => change("fuels", value)} choices={[...(station?.fuels ?? []), ...(fuelChoices ?? [])]} allowedFuels={allowedFuels} disabled={saving || !canEdit} />{errorMessage("fuels")}</div>
        <fieldset className="space-y-4"><legend className={labelClass}>Selling units</legend>
          <p className="text-sm text-obligon-text">Choose the unit used at this station. New fuels or unit changes need admin approval before prices or sales can use them. Quantities are not converted between units.</p>
          {draft.fuels.map(fuel => { const code = partnerFuelCode(fuel); const units = fuelSellingUnits(fuel); if (!code) return <p key={fuel} role="alert" className="text-sm text-red-800">Remove the unsupported fuel “{fuel}” before saving.</p>; return <label key={fuel} className="block text-sm font-bold text-obligon-navy">{fuel}
            <select aria-label={`${fuel} selling unit`} value={draft.sellingUnits[code] ?? (units.length === 1 ? units[0] : "")} onChange={event => change("sellingUnits", { ...draft.sellingUnits, [code]: event.target.value as SellingUnit })} className={fieldClass} required>
              {units.length > 1 ? <option value="">Choose selling unit</option> : null}
              {units.map(unit => <option key={unit} value={unit}>{sellingUnitLabel(unit)}</option>)}
            </select>
            <span className="mt-1 block text-xs font-normal text-obligon-text">Approved unit: {station?.approvedSellingUnits?.[code] ? sellingUnitLabel(station.approvedSellingUnits[code]) : "Awaiting admin approval"}</span>
          </label>; })}
          {errorMessage("sellingUnits")}
        </fieldset>
        <div id="station-hours" tabIndex={-1} className="scroll-mt-28 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-obligon-green"><OpeningHoursField value={draft.hours} onChange={value => change("hours", value)} disabled={saving || !canEdit} />{errorMessage("hours")}</div>
        <div id="station-position" tabIndex={-1} className="scroll-mt-28 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-obligon-green"><StationLocationPicker value={draft.location} onChange={value => change("location", value)} disabled={saving || !canEdit} />{errorMessage("location")}</div>
      </fieldset>
      <div className="mt-7 flex flex-col gap-3 border-t border-obligon-border pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-md text-xs leading-relaxed text-obligon-text">New stations and changed location details need admin approval before appearing to customers.</p>
        <div className="flex shrink-0 gap-2">
          {creating ? <button type="button" onClick={onCancel} disabled={saving || !canEdit} className="min-h-12 rounded-xl border border-obligon-border bg-white px-4 text-sm font-bold text-obligon-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-obligon-green disabled:opacity-50">Cancel</button> : null}
          {canEdit ? <button type="submit" disabled={saving || !canEdit} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-obligon-green px-5 text-sm font-extrabold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-obligon-green disabled:opacity-50">{saving ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Save size={18} aria-hidden="true" />}{saving ? "Saving…" : creating ? "Submit for approval" : "Save profile"}</button> : null}
        </div>
      </div>
    </form>
  );
}
