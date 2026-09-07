/**
 * plant-location.ts — customer location → nearest-plant assignment.
 *
 * Location capture is a manually entered address + city (more reliable for
 * a demo than a browser geolocation permission prompt). Coordinates come
 * from:
 *   1. a built-in city dictionary (deterministic, offline),
 *   2. a free-text Nominatim geocode as a fallback,
 *   3. null if neither resolves — in which case the caller falls back to
 *      the company's primary plant.
 */
import { supabase } from "@/integrations/supabase/client";
import { getCompanyPlantsServerFn } from "@/lib/plants.server";

/** Deterministic city → [lat, lng] for the demo's plant cities. */
const CITY_COORDS: Record<string, [number, number]> = {
  detroit: [42.3314, -83.0458],
  "detroit, mi": [42.3314, -83.0458],
  michigan: [42.3314, -83.0458],
  chicago: [41.8781, -87.6298],
  "chicago, il": [41.8781, -87.6298],
  illinois: [41.8781, -87.6298],
  vadodara: [22.3072, 73.1812],
  baroda: [22.3072, 73.1812],
  gujarat: [22.3072, 73.1812],
  kochi: [9.9312, 76.2673],
  cochin: [9.9312, 76.2673],
  kerala: [10.1632, 76.6413],
  mumbai: [19.076, 72.8777],
  delhi: [28.7041, 77.1025],
  "new delhi": [28.7041, 77.1025],
  bangalore: [12.9716, 77.5946],
  bengaluru: [12.9716, 77.5946],
  chennai: [13.0827, 80.2707],
  pune: [18.5204, 73.8567],
  ahmedabad: [23.0225, 72.5714],
  jaipur: [26.9124, 75.7873],
  hyderabad: [17.385, 78.4867],
  surat: [21.1702, 72.8311],
  london: [51.5074, -0.1278],
  "new york": [40.7128, -74.006],
  "los angeles": [34.0522, -118.2437],
  austin: [30.2672, -97.7431],
  houston: [29.7604, -95.3698],
  dallas: [32.7767, -96.797],
  seattle: [47.6062, -122.3321],
  toronto: [43.6532, -79.3832],
  "san francisco": [37.7749, -122.4194],
  boston: [42.3601, -71.0589],
  atlanta: [33.749, -84.388],
  miami: [25.7617, -80.1918],
  paris: [48.8566, 2.3522],
  berlin: [52.52, 13.405],
  singapore: [1.3521, 103.8198],
  dubai: [25.2048, 55.2708],
  sydney: [-33.8688, 151.2093],
};

export function cityLookup(city: string): [number, number] | null {
  const key = city.trim().toLowerCase();
  if (!key) return null;
  if (CITY_COORDS[key]) return CITY_COORDS[key];
  const match = Object.keys(CITY_COORDS).find((k) => key.includes(k) || k.includes(key));
  return match ? CITY_COORDS[match] : null;
}

/**
 * Geocode a free-text address. Tries the built-in dictionary first, then
 * Nominatim (no API key required). Never throws — returns null on failure
 * so the registration flow can fall back to the primary plant.
 */
export async function geocodeAddress(query: string): Promise<{ lat: number; lng: number } | null> {
  const q = (query ?? "").trim();
  if (!q) return null;
  const dict = cityLookup(q);
  if (dict) return { lat: dict[0], lng: dict[1] };
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`,
      { headers: { Accept: "application/json" }, signal: controller.signal },
    );
    clearTimeout(timer);
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{ lat: string; lon: string }>;
    const first = rows?.[0];
    if (!first) return null;
    return { lat: parseFloat(first.lat), lng: parseFloat(first.lon) };
  } catch {
    return null;
  }
}

/** Haversine distance in kilometres. */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Pick the nearest plant to a coordinate. Plants without coordinates are
 * ignored; if none has coordinates (or the company has no plants at all),
 * returns the company's primary plant — the one serving most plant-level
 * employees, else the first plant.
 */
export type PlantWithDistance = {
  id: string;
  name: string;
  code?: string | null;
  city?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  distanceKm?: number;
};

/**
 * Return every active plant for a company, each annotated with its distance
 * from the given coordinate (when both the plant and the point have
 * coordinates). Sorted nearest-first. No coordinates → plants stay unsorted
 * and distanceKm is undefined.
 */
export async function plantsForLocation(
  companyId: string,
  lat?: number | null,
  lng?: number | null,
): Promise<PlantWithDistance[]> {
  if (!companyId) return [];

  let rawPlants: any[] = [];

  // 1. Try server function first (works for both anon and authenticated)
  try {
    const serverResult = await getCompanyPlantsServerFn({ data: { companyId } });
    if (Array.isArray(serverResult) && serverResult.length > 0) {
      rawPlants = serverResult;
    }
  } catch (_) {
    // Non-fatal, fall back to direct client / RPC
  }

  // 2. Try get_active_plants RPC fallback
  if (rawPlants.length === 0) {
    try {
      const { data: rpcData, error: rpcErr } = await supabase.rpc("get_active_plants" as any, {
        p_company_id: companyId,
      });
      if (!rpcErr && Array.isArray(rpcData) && rpcData.length > 0) {
        rawPlants = rpcData;
      }
    } catch (_) {}
  }

  // 3. Try direct table query fallback
  if (rawPlants.length === 0) {
    const { data: plants } = await supabase
      .from("plants")
      .select("id, name, code, city, latitude, longitude, status")
      .eq("company_id", companyId)
      .eq("status", "active");
    if (plants && plants.length > 0) {
      rawPlants = plants;
    }
  }

  // 4. If still empty, check find_nearest_plant RPC
  if (rawPlants.length === 0) {
    try {
      const { data: nearestId } = await supabase.rpc("find_nearest_plant", {
        p_company_id: companyId,
        p_lat: lat ?? null,
        p_lng: lng ?? null,
      } as never);
      if (nearestId) {
        rawPlants = [{ id: nearestId, name: "Primary Plant", status: "active" }];
      }
    } catch (_) {}
  }

  if (!rawPlants.length) return [];

  const rows: PlantWithDistance[] = rawPlants.map((p) => ({
    id: p.id,
    name: p.name,
    code: p.code ?? null,
    city: p.city ?? null,
    latitude: p.latitude != null ? Number(p.latitude) : null,
    longitude: p.longitude != null ? Number(p.longitude) : null,
  }));

  if (lat != null && lng != null) {
    for (const p of rows) {
      if (p.latitude != null && p.longitude != null) {
        p.distanceKm = haversineKm(lat, lng, Number(p.latitude), Number(p.longitude));
      }
    }
    rows.sort((a, b) => {
      const da = a.distanceKm ?? Infinity;
      const db = b.distanceKm ?? Infinity;
      return da - db;
    });
  }
  return rows;
}

export async function nearestPlantForLocation(
  companyId: string,
  lat?: number | null,
  lng?: number | null,
): Promise<PlantWithDistance | null> {
  const rows = await plantsForLocation(companyId, lat, lng);
  if (!rows.length) return null;
  return rows[0] ?? null;
}