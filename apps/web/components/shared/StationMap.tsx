"use client";

import * as React from "react";

export interface StationMapPoint {
  id?: string;
  name: string;
  lat: number;
  lng: number;
}

type GoogleMapsApi = {
  maps: {
    Map: new (element: HTMLElement, options: Record<string, unknown>) => { fitBounds: (bounds: unknown) => void };
    LatLngBounds: new () => { extend: (position: unknown) => void };
    Marker: new (options: Record<string, unknown>) => { getPosition: () => unknown; addListener: (event: string, handler: () => void) => void };
  };
};

function osmEmbedUrl(list: StationMapPoint[]) {
  if (list.length === 0) return "https://www.openstreetmap.org/export/embed.html?bbox=3.30,6.45,3.45,6.60&layer=mapnik";
  const lats = list.map((item) => item.lat);
  const lngs = list.map((item) => item.lng);
  const pad = list.length === 1 ? 0.01 : 0.02;
  const minLat = Math.min(...lats) - pad;
  const maxLat = Math.max(...lats) + pad;
  const minLng = Math.min(...lngs) - pad;
  const maxLng = Math.max(...lngs) + pad;
  const marker = list.length === 1 ? `&marker=${list[0].lat},${list[0].lng}` : "";
  return `https://www.openstreetmap.org/export/embed.html?bbox=${minLng},${minLat},${maxLng},${maxLat}&layer=mapnik${marker}`;
}

/**
 * Provider-ready station map.
 * Uses the Google Maps JS API when NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is set
 * (interactive markers, live station detail), and falls back to an
 * OpenStreetMap embed otherwise — so the map always renders.
 */
export function StationMap({
  points,
  onSelect,
  height = "h-[320px] lg:h-[420px]"
}: {
  points: StationMapPoint[];
  onSelect?: (point: StationMapPoint) => void;
  height?: string;
}) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const mapRef = React.useRef<HTMLDivElement | null>(null);
  const [googleReady, setGoogleReady] = React.useState(false);

  // Load the Maps JS script once
  React.useEffect(() => {
    if (!apiKey) return;
    const w = window as unknown as { google?: unknown; __obligonMapsLoading?: boolean };
    if (w.google) {
      setGoogleReady(true);
      return;
    }
    if (w.__obligonMapsLoading) return;
    w.__obligonMapsLoading = true;
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=marker`;
    script.async = true;
    script.onload = () => setGoogleReady(true);
    document.head.appendChild(script);
  }, [apiKey]);

  // Render Google markers when ready
  React.useEffect(() => {
    if (!apiKey || !googleReady || !mapRef.current) return;
    const google = (window as unknown as { google: GoogleMapsApi }).google;
    const center = points[0] ?? { lat: 6.5244, lng: 3.3792, name: "Lagos" };
    const map = new google.maps.Map(mapRef.current, {
      center: { lat: center.lat, lng: center.lng },
      zoom: points.length > 1 ? 11 : 14,
      mapTypeControl: false,
      streetViewControl: false
    });
    const bounds = new google.maps.LatLngBounds();
    for (const point of points) {
      const marker = new google.maps.Marker({
        map,
        position: { lat: point.lat, lng: point.lng },
        title: point.name
      });
      bounds.extend(marker.getPosition());
      if (onSelect) {
        marker.addListener("click", () => onSelect(point));
      }
    }
    if (points.length > 1) {
      map.fitBounds(bounds);
    }
  }, [apiKey, googleReady, points, onSelect]);

  if (apiKey) {
    return (
      <div
        ref={mapRef}
        role="application"
        aria-label="Station map"
        className={`w-full rounded-2xl border border-[#dbe2d8] ${height}`}
      />
    );
  }

  return (
    <iframe
      title="Station map"
      src={osmEmbedUrl(points)}
      className={`w-full rounded-2xl border border-[#dbe2d8] ${height}`}
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
    />
  );
}
