import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * PostgREST returns a `to-one` embedded relation either as a single object or
 * as a one-element array depending on the query shape. Pages that render the
 * joined row should not each re-implement that normalization.
 */
export function resolveRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return (value[0] as T) ?? null;
  return value ?? null;
}

export type AppTimeFormat = "12h" | "24h" | "auto";

/**
 * Module-level time-format registry (set by PreferencesProvider on load and on
 * every change). Plain modules like `safeDate` read it so every timestamp in
 * the app respects the user's 12/24-hour preference — not just the settings
 * page. Defaults to "auto" (browser locale) until a preference is loaded.
 */
let _timeFormat: AppTimeFormat = "auto";
export function setAppTimeFormat(f: AppTimeFormat) {
  _timeFormat = f;
}
export function getAppTimeFormat(): AppTimeFormat {
  return _timeFormat;
}

/** Format a Date honoring the current app-wide time-format preference. */
export function formatTime(d: Date, includeDate = true): string {
  const fmt = _timeFormat;
  if (fmt === "12h") {
    let h = d.getHours();
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    const m = String(d.getMinutes()).padStart(2, "0");
    const time = `${h}:${m} ${ampm}`;
    return includeDate ? `${d.toLocaleDateString()}, ${time}` : time;
  }
  if (fmt === "24h") {
    const h = String(d.getHours()).padStart(2, "0");
    const m = String(d.getMinutes()).padStart(2, "0");
    const time = `${h}:${m}`;
    return includeDate ? `${d.toLocaleDateString()}, ${time}` : time;
  }
  return includeDate ? d.toLocaleString() : d.toLocaleTimeString();
}

/**
 * Safe date formatter — never throws on null/undefined/invalid values.
 * Returns "—" for any falsy or unparseable input instead of crashing.
 * When `includeTime` is true, the rendered time honors the user's saved
 * 12/24-hour preference (app-wide, per Bug 2 fix).
 */
export function safeDate(value: string | null | undefined, includeTime = false): string {
  if (!value) return "—";
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) return "—";
    return includeTime ? formatTime(d, true) : d.toLocaleDateString();
  } catch {
    return "—";
  }
}
