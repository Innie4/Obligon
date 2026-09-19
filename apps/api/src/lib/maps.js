import { env } from "../config/env.js";
import { providerFetch } from "./http.js";

/**
 * Google Maps Platform server wrappers: geocoding + directions.
 * The browser map itself uses NEXT_PUBLIC_GOOGLE_MAPS_API_KEY directly.
 */
const BASE = "https://maps.googleapis.com/maps/api";

export const mapsEnabled = () => Boolean(env.GOOGLE_MAPS_API_KEY);

async function mapsGet(path, params) {
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("key", env.GOOGLE_MAPS_API_KEY);
  const res = await providerFetch(url);
  const data = await res.json();
  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    throw new Error(`Maps API error: ${data.status} ${data.error_message ?? ""}`);
  }
  return data;
}

export async function geocode(address) {
  if (!mapsEnabled()) return null;
  const data = await mapsGet("/geocode/json", { address });
  const first = data.results?.[0];
  return first ? { lat: first.geometry.location.lat, lng: first.geometry.location.lng, formatted: first.formatted_address } : null;
}

/** Returns polyline + legs for driving directions between two points. */
export async function directions({ origin, destination }) {
  if (!mapsEnabled()) return null;
  const data = await mapsGet("/directions/json", {
    origin: typeof origin === "string" ? origin : `${origin.lat},${origin.lng}`,
    destination: typeof destination === "string" ? destination : `${destination.lat},${destination.lng}`,
    mode: "driving"
  });
  const route = data.routes?.[0];
  if (!route) return null;
  return {
    polyline: route.overview_polyline?.points ?? "",
    distanceText: route.legs?.[0]?.distance?.text ?? "",
    durationText: route.legs?.[0]?.duration?.text ?? ""
  };
}

/** Distance matrix for "nearest station" ranking when lat/lng supplied client-side. */
export async function distanceMatrix(origins, destinations) {
  if (!mapsEnabled()) return null;
  const data = await mapsGet("/distancematrix/json", {
    origins: origins.join("|"),
    destinations: destinations.join("|"),
    mode: "driving"
  });
  return data.rows?.map((r) => r.elements?.map((e) => ({ distance: e.distance?.text, duration: e.duration?.text }))) ?? null;
}
