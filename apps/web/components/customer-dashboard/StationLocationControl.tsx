"use client";

import * as React from "react";
import { LocateFixed, MapPin, SlidersHorizontal } from "lucide-react";
import { api } from "@/lib/services";
import { StatusPopup } from "@/components/shared/StatusPopup";
import { ModalFrame } from "./CustomerModals";
import { useCustomerPreferences } from "./CustomerTheme";

export type StationOrigin = { lat: number; lng: number };
export function stationOrigin(lat: string | number, lng: string | number): StationOrigin | null {
  if (String(lat).trim() === "" || String(lng).trim() === "") return null;
  const point = { lat: Number(lat), lng: Number(lng) };
  return Number.isFinite(point.lat) && Number.isFinite(point.lng) && Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180 ? point : null;
}

export function useStationLocation() {
  const { preferences, loading, saving, error: preferenceError, savePreferences, reloadPreferences } = useCustomerPreferences();
  const [location, setLocation] = React.useState<StationOrigin>();
  const [mode, setMode] = React.useState<"browse" | "current" | "manual">("browse");
  const [promptOpen, setPromptOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [coordinates, setCoordinates] = React.useState({ lat: "", lng: "" });
  const watch = React.useRef<number | null>(null);
  const generation = React.useRef(0);
  const mounted = React.useRef(false);
  const claimed = React.useRef(false);
  const manual = React.useRef(false);

  const stop = React.useCallback(() => {
    generation.current += 1;
    if (watch.current !== null) navigator.geolocation?.clearWatch(watch.current);
    watch.current = null;
  }, []);

  const start = React.useCallback(() => {
    if (watch.current !== null) return;
    if (!navigator.geolocation) { setError("Location is unavailable. Search or filter the station list instead."); return; }
    const current = ++generation.current;
    setBusy(true);
    setError("");
    watch.current = navigator.geolocation.watchPosition(({ coords }) => {
      if (!mounted.current || generation.current !== current) return;
      const point = stationOrigin(coords.latitude, coords.longitude);
      if (!point) return;
      // Ignore sensor jitter so a stationary device does not continuously refetch.
      setLocation(previous => previous && Math.abs(previous.lat - point.lat) < 0.0001 && Math.abs(previous.lng - point.lng) < 0.0001 ? previous : point);
      setMode("current");
      setBusy(false);
      setError("");
    }, () => {
      if (!mounted.current || generation.current !== current) return;
      stop();
      setLocation(undefined);
      setMode("browse");
      setBusy(false);
      setError("Location is unavailable. Check your browser settings or browse all stations.");
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 });
  }, [stop]);

  React.useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; stop(); };
  }, [stop]);

  React.useEffect(() => {
    if (loading || preferenceError || !preferences || preferences.stationLocation.prompted || claimed.current) return;
    claimed.current = true;
    void api.request<{ showPrompt: boolean }>("/api/customer/preferences/location-prompt", { method: "POST" })
      .then(result => { if (mounted.current && result.showPrompt) setPromptOpen(true); })
      .catch(() => { if (mounted.current) setError("Your location preference could not be checked. You can open Location settings to choose it."); })
      .finally(() => { if (mounted.current) reloadPreferences(); });
  }, [loading, preferenceError, preferences, reloadPreferences]);

  React.useEffect(() => {
    if (preferences?.stationLocation.enabled && !manual.current) start();
    else if (!manual.current) { stop(); setLocation(undefined); setMode("browse"); setBusy(false); }
    return stop;
  }, [preferences?.stationLocation.enabled, start, stop]);

  async function chooseCurrentLocation() {
    try {
      setError("");
      await savePreferences({ stationLocation: { prompted: true, enabled: true } });
      if (!mounted.current) return;
      manual.current = false;
      setPromptOpen(false);
      start();
    } catch { if (mounted.current) setError("Your location choice could not be saved. Try again."); }
  }

  async function browseWithoutLocation() {
    try {
      await savePreferences({ stationLocation: { prompted: true, enabled: false } });
      if (!mounted.current) return;
      manual.current = false;
      stop();
      setLocation(undefined);
      setMode("browse");
      setBusy(false);
      setError("");
      setPromptOpen(false);
    } catch { if (mounted.current) setError("Your location choice could not be saved. Try again."); }
  }

  async function chooseManualLocation(event: React.FormEvent) {
    event.preventDefault();
    const point = stationOrigin(coordinates.lat, coordinates.lng);
    if (!point) { setError("Enter a valid latitude and longitude."); return; }
    try {
      await savePreferences({ stationLocation: { prompted: true, enabled: false } });
      if (!mounted.current) return;
      manual.current = true;
      stop();
      setLocation(point);
      setMode("manual");
      setBusy(false);
      setError("");
      setPromptOpen(false);
    } catch { manual.current = false; if (mounted.current) setError("Your location choice could not be saved. Try again."); }
  }

  return { location, mode, promptOpen, busy, saving, loading, error: error || preferenceError, coordinates, setCoordinates,
    openSettings: () => { setError(""); setPromptOpen(true); }, closeSettings: () => setPromptOpen(false),
    chooseCurrentLocation, browseWithoutLocation, chooseManualLocation };
}

export function StationLocationControl({ state }: { state: ReturnType<typeof useStationLocation> }) {
  return <>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-obligon-border pb-5">
      <div className="flex items-start gap-3">
        <MapPin size={20} className="mt-0.5 shrink-0 text-obligon-green" aria-hidden="true" />
        <div><p className="text-sm font-bold text-obligon-navy">{state.mode === "current" ? "Nearest stations first" : state.mode === "manual" ? "Near your selected location" : "Registered Obligon stations"}</p>
          <p className="mt-1 text-xs leading-5 text-obligon-text">{state.location ? "Straight-line distance. Search and filters keep the nearest matches first." : "Search and filter the network, or choose a location to sort by distance."}</p></div>
      </div>
      <button type="button" disabled={state.loading || state.saving} onClick={state.openSettings} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-obligon-border bg-white px-4 text-sm font-bold text-obligon-green disabled:opacity-50"><SlidersHorizontal size={16} aria-hidden="true" />Location settings</button>
    </div>
    {state.busy ? <StatusPopup tone="loading" message="Finding your nearest stations…" /> : null}
    {state.saving ? <StatusPopup tone="pending" message="Saving your location choice…" /> : null}
    {state.error ? <StatusPopup tone="error" message={state.error} /> : null}
    {state.promptOpen ? <ModalFrame title="Find stations near you" onClose={state.closeSettings}>
      <div className="p-6 sm:p-8">
        <div aria-hidden="true" className="mb-6 flex h-28 items-center justify-center rounded-2xl bg-obligon-mist"><LocateFixed size={58} strokeWidth={1.25} className="text-obligon-green" /></div>
        <h2 className="font-display text-2xl font-bold tracking-tight text-obligon-navy">Find stations near you</h2>
        <p className="mt-3 text-sm leading-6 text-obligon-text">Use your location to show the nearest registered Obligon stations first. You can still search and filter the list.</p>
        <p className="mt-3 text-xs leading-5 text-obligon-text">Your location is used to sort stations. You can turn it off at any time.</p>
        <div className="mt-6 grid gap-3">
          <button type="button" disabled={state.saving} onClick={() => void state.chooseCurrentLocation()} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-obligon-green px-5 font-bold text-white disabled:opacity-50"><LocateFixed size={18} aria-hidden="true" />Use my location</button>
          <button type="button" disabled={state.saving} onClick={() => void state.browseWithoutLocation()} className="min-h-12 rounded-xl border border-obligon-border bg-white px-5 font-bold text-obligon-navy disabled:opacity-50">Browse without location</button>
        </div>
        <details className="mt-4 text-sm">
          <summary className="min-h-11 cursor-pointer py-3 font-semibold text-obligon-text">Set location manually</summary>
          <form onSubmit={state.chooseManualLocation} className="mt-2 grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-semibold text-obligon-navy">Latitude<input required type="number" step="any" min="-90" max="90" value={state.coordinates.lat} onChange={event => state.setCoordinates(previous => ({ ...previous, lat: event.target.value }))} className="mt-2 min-h-12 w-full rounded-xl border border-obligon-border bg-white px-3" /></label>
            <label className="text-sm font-semibold text-obligon-navy">Longitude<input required type="number" step="any" min="-180" max="180" value={state.coordinates.lng} onChange={event => state.setCoordinates(previous => ({ ...previous, lng: event.target.value }))} className="mt-2 min-h-12 w-full rounded-xl border border-obligon-border bg-white px-3" /></label>
            <button type="submit" disabled={state.saving} className="min-h-12 rounded-xl border border-obligon-border px-4 font-bold text-obligon-green disabled:opacity-50 sm:col-span-2">Find closest stations</button>
          </form>
        </details>
      </div>
    </ModalFrame> : null}
  </>;
}
