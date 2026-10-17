import type { PartnerStation } from "@/lib/services/types";
import type { StationLocation } from "@/components/dashboard/StationLocationPicker";
import { isNigeriaCity, nigeriaCityLabel, parseNigeriaCityLabel } from "../../../packages/shared/nigeria-cities.mjs";
import { parseOpeningHours, openingHoursText, validateOpeningHours, type OpeningHoursValue } from "./station-profile-fields";

export type StationProfileDraft = {
  name: string;
  address: string;
  state: string;
  city: string;
  hours: OpeningHoursValue;
  fuels: string[];
  location: StationLocation | null;
};
export type StationProfileSubmission = {
  name: string;
  address: string;
  city: string;
  hours: string;
  fuels: string[];
  lat: number;
  lng: number;
};
export type StationProfileErrors = Partial<Record<keyof StationProfileDraft, string>>;
type Station = PartnerStation["station"];

export function stationProfileDraft(station: Station): StationProfileDraft {
  const place = parseNigeriaCityLabel(station?.city ?? "");
  const lat = station?.lat, lng = station?.lng;
  return {
    name: station?.name ?? "", address: station?.address ?? "",
    state: place?.state ?? "", city: place?.city ?? "",
    hours: parseOpeningHours(station?.hours ?? null),
    fuels: station?.fuels ? [...station.fuels] : [],
    location: typeof lat === "number" && Number.isFinite(lat) && Math.abs(lat) <= 90 && typeof lng === "number" && Number.isFinite(lng) && Math.abs(lng) <= 180 ? { lat, lng } : null
  };
}

function savedCity(draft: StationProfileDraft, station: Station) {
  const old = parseNigeriaCityLabel(station?.city ?? "");
  // Editing an unrelated field must not rewrite a recorded location or trigger review.
  if (station?.city && ((old && old.state === draft.state && old.city === draft.city) || (!old && !draft.state && !draft.city))) return station.city;
  return nigeriaCityLabel(draft.state, draft.city);
}

export function stationProfileErrors(draft: StationProfileDraft, station: Station): StationProfileErrors {
  const errors: StationProfileErrors = {};
  if (!draft.name.trim() || draft.name.trim().length > 200) errors.name = "Enter a station name of up to 200 characters.";
  if (!draft.address.trim() || draft.address.trim().length > 500) errors.address = "Enter the physical address, up to 500 characters.";
  const unchangedLegacy = Boolean(station?.city && !parseNigeriaCityLabel(station.city) && !draft.state && !draft.city);
  if (!unchangedLegacy && !draft.state) errors.state = "Choose the station’s State or FCT.";
  if (!unchangedLegacy && !isNigeriaCity(draft.state, draft.city)) errors.city = "Choose a city or town in the selected State / FCT.";
  if (!savedCity(draft, station) || (savedCity(draft, station)?.length ?? 0) > 100) errors.city = "Choose a valid city and State / FCT.";
  if (!draft.fuels.length || draft.fuels.length > 20 || draft.fuels.some(fuel => !fuel.trim() || fuel.length > 80)) errors.fuels = "Select at least one fuel, up to 20 options.";
  const hoursError = validateOpeningHours(draft.hours);
  if (hoursError) errors.hours = hoursError;
  if (!draft.location || !Number.isFinite(draft.location.lat) || !Number.isFinite(draft.location.lng) || Math.abs(draft.location.lat) > 90 || Math.abs(draft.location.lng) > 180) errors.location = "Use GPS or choose the station’s exact position on the map.";
  return errors;
}

export function stationProfileSubmission(draft: StationProfileDraft, station: Station): StationProfileSubmission {
  const errors = stationProfileErrors(draft, station);
  if (Object.keys(errors).length || !draft.location) throw new Error(Object.values(errors)[0] ?? "Choose the station location.");
  return {
    name: draft.name.trim(), address: draft.address.trim(), city: savedCity(draft, station)!,
    fuels: [...draft.fuels], hours: openingHoursText(draft.hours),
    lat: draft.location.lat, lng: draft.location.lng
  };
}
