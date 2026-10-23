"use client";

import * as React from "react";
import { StatusPopup } from "./StatusPopup";

export interface StationMapPoint { id?: string; name: string; lat: number; lng: number; }
type MapState = "loading" | "ready" | "unverified" | "unavailable";
type MapListener = { remove: () => void };
type GoogleMapsApi = { maps: {
  Map: new (element: HTMLElement, options: Record<string, unknown>) => { fitBounds: (bounds: unknown) => void; addListener?: (event: string, handler: () => void) => MapListener };
  LatLngBounds: new () => { extend: (position: unknown) => void };
  Marker: new (options: Record<string, unknown>) => { getPosition: () => unknown; addListener: (event: string, handler: () => void) => MapListener; setMap?: (map: null) => void };
} };

const pointKey = (point: StationMapPoint) => point.id ?? `${point.lat},${point.lng},${point.name}`;
const validApi = (value: unknown): value is GoogleMapsApi => {
  const maps = (value as GoogleMapsApi | undefined)?.maps;
  return typeof maps?.Map === "function" && typeof maps.LatLngBounds === "function" && typeof maps.Marker === "function";
};
let googleMapsLoading: Promise<GoogleMapsApi> | null = null;

function loadGoogleMaps(apiKey: string): Promise<GoogleMapsApi> {
  const current = (window as unknown as { google?: unknown }).google;
  if (validApi(current)) return Promise.resolve(current);
  if (googleMapsLoading) return googleMapsLoading;
  googleMapsLoading = new Promise<GoogleMapsApi>((resolve, reject) => {
    const script = document.createElement("script");
    let settled = false;
    const finish = (failed = false) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      script.onload = null; script.onerror = null;
      const api = (window as unknown as { google?: unknown }).google;
      if (!failed && validApi(api)) resolve(api);
      else { script.remove(); reject(new Error("The map provider could not be loaded.")); }
    };
    const timeout = setTimeout(() => finish(true), 12000);
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=marker`;
    script.async = true;
    script.onload = () => finish();
    script.onerror = () => finish(true);
    document.head.appendChild(script);
  }).catch(error => { googleMapsLoading = null; throw error; });
  return googleMapsLoading;
}

function osmEmbedUrl(list: StationMapPoint[]) {
  const latitudes = list.map(point => point.lat), longitudes = list.map(point => point.lng);
  const pad = list.length === 1 ? 0.01 : 0.02;
  const bbox = [Math.min(...longitudes) - pad, Math.min(...latitudes) - pad, Math.max(...longitudes) + pad, Math.max(...latitudes) + pad].join(",");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik${list.length === 1 ? `&marker=${list[0].lat},${list[0].lng}` : ""}`;
}

/** A station map is an enhancement; provider failures never hide the station list. */
export function StationMap({ points, onSelect, height = "h-[280px] lg:h-[360px]" }: {
  points: StationMapPoint[]; onSelect?: (point: StationMapPoint) => void; height?: string;
}) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const mapRef = React.useRef<HTMLDivElement | null>(null);
  const selectRef = React.useRef(onSelect);
  selectRef.current = onSelect;
  const [selectedKey, setSelectedKey] = React.useState("");
  const [state, setState] = React.useState<MapState>("loading");
  const [revision, setRevision] = React.useState(0);
  const validPoints = points.filter(point => Number.isFinite(point.lat) && Number.isFinite(point.lng) && Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180);
  const selected = validPoints.find(point => pointKey(point) === selectedKey);
  const displayPoints = selected ? [selected] : validPoints;
  const embedUrl = displayPoints.length ? osmEmbedUrl(displayPoints) : "";
  const frameKey = `${embedUrl}:${revision}`;
  const frameIdentity = React.useRef(frameKey);
  frameIdentity.current = frameKey;
  const pointsRevision = displayPoints.map(point => `${pointKey(point)}:${point.name}:${point.lat},${point.lng}`).join("|");
  const first = displayPoints[0];
  const fullMapUrl = first ? `https://www.openstreetmap.org/?mlat=${first.lat}&mlon=${first.lng}#map=14/${first.lat}/${first.lng}` : "https://www.openstreetmap.org/";

  React.useEffect(() => {
    if (!embedUrl) return;
    frameIdentity.current = frameKey;
    let active = true;
    setState("loading");
    let tileTimer: ReturnType<typeof setTimeout> | undefined;
    const listeners: MapListener[] = [];
    const markers: Array<{ setMap?: (map: null) => void }> = [];
    if (apiKey) {
      void loadGoogleMaps(apiKey).then(google => {
        if (!active || !mapRef.current) return;
        try {
          const map = new google.maps.Map(mapRef.current, { center: { lat: first.lat, lng: first.lng }, zoom: displayPoints.length > 1 ? 11 : 14, mapTypeControl: false, streetViewControl: false });
          tileTimer = setTimeout(() => { if (active) setState("unavailable"); }, 12000);
          if (map.addListener) listeners.push(map.addListener("tilesloaded", () => { clearTimeout(tileTimer); if (active) setState("ready"); }));
          else setState("unverified");
          const bounds = new google.maps.LatLngBounds();
          displayPoints.forEach(point => {
            const marker = new google.maps.Marker({ map, position: { lat: point.lat, lng: point.lng }, title: point.name });
            markers.push(marker); bounds.extend(marker.getPosition());
            if (selectRef.current) listeners.push(marker.addListener("click", () => selectRef.current?.(point)));
          });
          if (displayPoints.length > 1) map.fitBounds(bounds);
        } catch { clearTimeout(tileTimer); if (active) setState("unavailable"); }
      }).catch(() => { if (active) setState("unavailable"); });
    } else tileTimer = setTimeout(() => { if (active) setState(current => current === "loading" ? "unavailable" : current); }, 12000);
    return () => { active = false; if (frameIdentity.current === frameKey) frameIdentity.current = ""; clearTimeout(tileTimer); listeners.forEach(listener => listener.remove()); markers.forEach(marker => marker.setMap?.(null)); };
  }, [apiKey, embedUrl, pointsRevision, revision]);

  if (!validPoints.length) return <div className="rounded-xl bg-obligon-mist/60 p-5 text-sm leading-6 text-obligon-text"><p className="font-semibold text-obligon-navy">Map locations unavailable</p><p className="mt-1">Use the station addresses and Directions buttons in the list.</p></div>;

  return <div className="min-w-0">
    {state === "loading" || state === "unavailable" ? <StatusPopup
      tone={state === "loading" ? "loading" : "error"}
      title={state === "loading" ? "Loading station map…" : "Map preview unavailable"}
      message={state === "loading" ? "Station details and directions are available in the list." : "Use the station list or open the full map in a new tab."}
      onRetry={state === "unavailable" ? () => setRevision(value => value + 1) : undefined}
      retryLabel="Retry map preview"
    /> : null}
    <div className={`relative overflow-hidden rounded-xl border border-obligon-border bg-obligon-mist/60 ${height} ${state === "unavailable" ? "hidden" : ""}`}>
      {apiKey ? <div ref={mapRef} aria-label="Station map" className={`h-full w-full ${state === "unavailable" ? "invisible" : ""}`} /> : <iframe key={frameKey} title="Station map" src={embedUrl} referrerPolicy="no-referrer-when-downgrade" onLoad={() => { if (frameIdentity.current === frameKey) setState(current => current === "unavailable" ? current : "unverified"); }} onError={() => { if (frameIdentity.current === frameKey) setState("unavailable"); }} className={`h-full w-full border-0 ${state === "unavailable" ? "invisible" : ""}`} />}
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3 px-1 py-3 text-xs leading-5 text-obligon-text">
      <p className="max-w-md">{state === "unverified" ? "The map is supplied by an external provider. If its preview is blank, use the full map or the station list." : "Map preview is optional. Station details and directions stay available in the list."}</p>
      <a href={fullMapUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-2 text-sm font-semibold text-obligon-green underline">Open full map</a>
    </div>
    {onSelect ? <div className="flex flex-wrap gap-2">{validPoints.map(point => <button key={pointKey(point)} type="button" aria-pressed={selectedKey === pointKey(point)} className="min-h-11 rounded-xl border border-obligon-border bg-white px-3 text-sm font-semibold text-obligon-navy" onClick={() => { setSelectedKey(pointKey(point)); onSelect(point); }}>{point.name}</button>)}</div> : null}
  </div>;
}
