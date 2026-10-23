"use client";

import * as React from "react";
import type { Map as LeafletMap, Marker, TileLayer } from "leaflet";
import "leaflet/dist/leaflet.css";

export type StationLocation = { lat: number; lng: number; accuracyMeters?: number };
const MIN_PLACEMENT_ZOOM = 16;
const buttonClass = "inline-flex min-h-11 items-center justify-center rounded-lg border border-obligon-border bg-white px-4 py-2 text-sm font-bold text-obligon-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obligon-green focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

function validLocation(point: StationLocation | null): point is StationLocation {
  return Boolean(point && Number.isFinite(point.lat) && Number.isFinite(point.lng) &&
    Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180);
}

function mapLocation(point: { lat: number; lng: number }): StationLocation | null {
  const location = { lat: point.lat, lng: Math.abs(point.lng) <= 180 ? point.lng : ((point.lng + 180) % 360 + 360) % 360 - 180 };
  return validLocation(location) ? location : null;
}

export function StationLocationPicker({ value, onChange, disabled = false }: {
  value: StationLocation | null;
  onChange: (location: StationLocation) => void;
  disabled?: boolean;
}) {
  const container = React.useRef<HTMLDivElement | null>(null);
  const map = React.useRef<LeafletMap | null>(null);
  const tiles = React.useRef<TileLayer | null>(null);
  const marker = React.useRef<Marker | null>(null);
  const syncMarker = React.useRef<((point: StationLocation | null) => void) | null>(null);
  const current = React.useRef({ value, onChange, disabled });
  current.current = { value, onChange, disabled };
  const mounted = React.useRef(false);
  const gpsSequence = React.useRef(0);
  const gpsTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const tileFailed = React.useRef(false);
  const tilesReady = React.useRef(false);
  const [gpsBusy, setGpsBusy] = React.useState(false);
  const [gpsError, setGpsError] = React.useState("");
  const [notice, setNotice] = React.useState("");
  const [mapError, setMapError] = React.useState("");
  const [tileError, setTileError] = React.useState(false);
  const [tilesLoaded, setTilesLoaded] = React.useState(false);
  const [mapReady, setMapReady] = React.useState(false);
  const [zoom, setZoom] = React.useState(validLocation(value) ? 17 : 6);
  const [mapAttempt, setMapAttempt] = React.useState(0);

  function cancelGps() {
    gpsSequence.current += 1;
    if (gpsTimer.current !== null) clearTimeout(gpsTimer.current);
    gpsTimer.current = null;
    setGpsBusy(false);
  }

  function selectMapPoint(point: { lat: number; lng: number }) {
    if (current.current.disabled || !map.current) return false;
    if (!tilesReady.current || tileFailed.current) {
      setNotice("Wait for the map tiles to load before placing the station pin, or use GPS.");
      return false;
    }
    if (map.current.getZoom() < MIN_PLACEMENT_ZOOM) {
      setNotice("Zoom in until you can see the station, then choose its exact position.");
      return false;
    }
    const location = mapLocation(point);
    if (!location) return false;
    cancelGps();
    setGpsError("");
    setNotice("Station pin selected. Save Profile to apply this location.");
    current.current.onChange(location);
    return true;
  }

  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      gpsSequence.current += 1;
      if (gpsTimer.current !== null) clearTimeout(gpsTimer.current);
    };
  }, []);

  React.useEffect(() => {
    if (disabled) cancelGps();
    if (disabled || zoom < MIN_PLACEMENT_ZOOM) marker.current?.dragging?.disable();
    else marker.current?.dragging?.enable();
    // The invalidation reads refs; it does not depend on a render's callbacks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled, zoom]);

  React.useEffect(() => {
    cancelGps();
    syncMarker.current?.(validLocation(value) ? value : null);
    // Parent keys this picker by station, so a new station also cancels GPS.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.lat, value?.lng]);

  React.useEffect(() => {
    let active = true;
    let instance: LeafletMap | null = null;
    setMapReady(false);
    setMapError("");
    tileFailed.current = false;
    tilesReady.current = false;
    setTileError(false);
    setTilesLoaded(false);
    void import("leaflet").then((L) => {
      if (!active || !container.current) return;
      const point = validLocation(current.current.value) ? current.current.value : null;
      instance = L.map(container.current, {
        center: point ? [point.lat, point.lng] : [9.08, 8.67],
        zoom: point ? 17 : 6,
        minZoom: 3, maxZoom: 19, zoomControl: false, keyboard: false,
        scrollWheelZoom: false, zoomAnimation: false, fadeAnimation: false,
        markerZoomAnimation: false, inertia: false,
      });
      map.current = instance;
      tiles.current = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        referrerPolicy: "strict-origin-when-cross-origin",
      }).addTo(instance);
      tiles.current.on("loading", () => {
        if (!active) return;
        tilesReady.current = false;
        setTilesLoaded(false);
      });
      tiles.current.on("tileerror", () => {
        if (!active) return;
        tileFailed.current = true;
        tilesReady.current = false;
        setTileError(true);
        setTilesLoaded(false);
      });
      tiles.current.on("load", () => {
        if (!active || tileFailed.current) return;
        tilesReady.current = true;
        setTilesLoaded(true);
      });
      const refreshZoom = () => { if (active && instance) setZoom(instance.getZoom()); };
      instance.on("zoomend", refreshZoom);
      instance.on("click", (event) => { if (active) selectMapPoint(event.latlng); });
      syncMarker.current = (location) => {
        if (!instance || !active) return;
        if (!location) {
          marker.current?.remove();
          marker.current = null;
          return;
        }
        if (marker.current) marker.current.setLatLng([location.lat, location.lng]);
        else {
          marker.current = L.marker([location.lat, location.lng], {
            draggable: !current.current.disabled,
            keyboard: true,
            title: "Selected station location. Drag the pin to adjust, or pan the map and use its centre.",
            icon: L.divIcon({ className: "text-obligon-green", iconSize: [44, 44], iconAnchor: [22, 40],
              html: '<svg class="mx-auto" width="32" height="40" viewBox="0 0 32 40" aria-hidden="true"><path d="M16 1C7.7 1 1 7.7 1 16c0 11 15 23 15 23s15-12 15-23C31 7.7 24.3 1 16 1Z" fill="currentColor" stroke="white" stroke-width="2"/><circle cx="16" cy="16" r="5" fill="white"/></svg>' }),
          }).addTo(instance);
          marker.current.on("dragend", () => {
            if (!active) return;
            const location = marker.current?.getLatLng();
            if (location && !selectMapPoint(location) && validLocation(current.current.value)) {
              marker.current?.setLatLng([current.current.value.lat, current.current.value.lng]);
            }
          });
        }
        if (current.current.disabled) marker.current.dragging?.disable();
        instance.setView([location.lat, location.lng], Math.max(instance.getZoom(), 17), { animate: false });
      };
      syncMarker.current(point);
      setZoom(instance.getZoom());
      setMapReady(true);
    }).catch(() => {
      if (!active) return;
      instance?.remove();
      instance = null;
      map.current = null;
      tiles.current = null;
      marker.current = null;
      syncMarker.current = null;
      tilesReady.current = false;
      setTilesLoaded(false);
      setMapError("The map could not load. You can still use GPS to select the station location.");
    });
    return () => {
      active = false;
      tilesReady.current = false;
      syncMarker.current = null;
      instance?.remove();
      map.current = null;
      tiles.current = null;
      marker.current = null;
    };
    // Map handlers deliberately read current props through refs, without remounting.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapAttempt]);

  function locate() {
    if (current.current.disabled || gpsBusy || gpsTimer.current !== null) return;
    cancelGps();
    setGpsError("");
    setNotice("");
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGpsError("GPS is not supported in this browser. Use the map to select the station position.");
      return;
    }
    const request = gpsSequence.current;
    const stillCurrent = () => mounted.current && !current.current.disabled && request === gpsSequence.current;
    const fail = (code: number) => {
      if (!stillCurrent()) return;
      cancelGps();
      setGpsError(code === 1 ? "Location permission was denied. Allow location access and try again, or use the map."
        : code === 3 ? "The GPS request timed out. Try again outside, or select the position on the map."
          : "Your GPS location is unavailable. Check your device location settings and try again, or use the map.");
    };
    setGpsBusy(true);
    gpsTimer.current = setTimeout(() => fail(3), 15000);
    try {
      navigator.geolocation.getCurrentPosition((result) => {
        if (!stillCurrent()) return;
        const location: StationLocation = { lat: result.coords.latitude, lng: result.coords.longitude };
        if (!validLocation(location)) { fail(2); return; }
        if (Number.isFinite(result.coords.accuracy) && result.coords.accuracy >= 0) location.accuracyMeters = result.coords.accuracy;
        cancelGps();
        setNotice("GPS position selected. Check the pin, adjust it if needed, then Save Profile to apply it.");
        current.current.onChange(location);
      }, (error) => fail(error.code), { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
    } catch { fail(2); }
  }

  function handleMapKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget || current.current.disabled || !mapReady || !map.current ||
        event.altKey || event.ctrlKey || event.metaKey) return;
    const directions: Record<string, [number, number]> = {
      ArrowLeft: [-80, 0], ArrowRight: [80, 0], ArrowUp: [0, -80], ArrowDown: [0, 80],
    };
    const direction = directions[event.key];
    const zoomIn = event.key === "+" || event.key === "=";
    const zoomOut = event.key === "-";
    if (!direction && !zoomIn && !zoomOut) return;
    event.preventDefault();
    event.stopPropagation();
    if (direction) map.current.panBy(direction, { animate: false });
    else if (zoomIn && map.current.getZoom() < 19) map.current.zoomIn(1, { animate: false });
    else if (zoomOut && map.current.getZoom() > 3) map.current.zoomOut(1, { animate: false });
  }

  const selected = validLocation(value) ? value : null;
  return <section className="min-w-0 space-y-3" aria-label="Station location picker">
    <p className="text-xs font-semibold uppercase text-obligon-text">Exact station location</p>
    <p className="text-sm text-obligon-text">Stand at your station and use GPS, or zoom in and place the pin on its exact position. Pan the map with touch or arrow keys.</p>
    <button type="button" className="inline-flex min-h-11 items-center justify-center rounded-lg border border-obligon-green bg-obligon-green px-4 py-2 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obligon-green focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" disabled={disabled || gpsBusy} aria-busy={gpsBusy} onClick={locate}>
      {gpsBusy ? "Finding GPS location…" : "Use my GPS location"}
    </button>
    {gpsError && <p role="alert" className="text-sm font-semibold text-red-700">{gpsError}</p>}
    <div className="relative isolate z-0 overflow-hidden rounded-xl border border-obligon-border">
      <div ref={container} tabIndex={0} role="region" aria-label="Adjustable station map" onKeyDown={handleMapKeyDown} className="h-[320px] w-full bg-obligon-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-obligon-green" />
      {!mapReady && !mapError && <p role="status" className="p-3 text-sm text-obligon-text">Loading station map…</p>}
      {mapReady && !tilesLoaded && !tileError && <p role="status" className="p-3 text-sm text-obligon-text">Loading map tiles before pin placement…</p>}
    </div>
    {mapError && <div role="alert" className="space-y-2 text-sm text-red-700"><p>{mapError}</p><button type="button" className={buttonClass} disabled={disabled} onClick={() => setMapAttempt((attempt) => attempt + 1)}>Retry map</button></div>}
    {tileError && <div role="alert" className="space-y-2 text-sm text-red-700"><p>Map tiles could not load. GPS still works; retry the map before placing a pin manually.</p><button type="button" className={buttonClass} disabled={disabled} onClick={() => { tileFailed.current = false; tilesReady.current = false; setTileError(false); setTilesLoaded(false); tiles.current?.redraw(); }}>Retry map tiles</button></div>}
    <div className="flex flex-wrap gap-2">
      <button type="button" className={buttonClass} disabled={disabled || !mapReady || zoom >= 19} onClick={() => map.current?.zoomIn(1, { animate: false })}>Zoom in</button>
      <button type="button" className={buttonClass} disabled={disabled || !mapReady || zoom <= 3} onClick={() => map.current?.zoomOut(1, { animate: false })}>Zoom out</button>
      <button type="button" className={buttonClass} disabled={disabled || !mapReady || !tilesLoaded || tileError || zoom < MIN_PLACEMENT_ZOOM} onClick={() => { const centre = map.current?.getCenter(); if (centre) selectMapPoint(centre); }}>Use map centre</button>
    </div>
    {mapReady && zoom < MIN_PLACEMENT_ZOOM && <p className="text-sm text-obligon-text">Zoom in until you can see the station before choosing a position.</p>}
    {selected ? <div className="rounded-lg bg-obligon-mist p-3 text-sm text-obligon-navy"><p>Selected position: <output>{selected.lat.toFixed(6)}, {selected.lng.toFixed(6)}</output></p>
      {Number.isFinite(selected.accuracyMeters) && selected.accuracyMeters! >= 0 && <p>Approximate GPS accuracy: ±{Math.ceil(selected.accuracyMeters!)} metres. Adjust the pin if needed.</p>}
      <p className="mt-1">Save Profile to apply this location. Changes require admin approval.</p></div>
      : <p className="text-sm font-semibold text-obligon-text">No station position selected yet.</p>}
    {notice && <p role="status" className="text-sm font-semibold text-obligon-green">{notice}</p>}
    <a className="inline-flex min-h-11 items-center text-sm font-semibold text-obligon-green underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obligon-green focus-visible:ring-offset-2" href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noreferrer">Report a map issue</a>
  </section>;
}
