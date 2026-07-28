import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Safe date formatter — never throws on null/undefined/invalid values.
 * Returns "—" for any falsy or unparseable input instead of crashing.
 */
export function safeDate(value: string | null | undefined, includeTime = false): string {
  if (!value) return "—";
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) return "—";
    return includeTime ? d.toLocaleString() : d.toLocaleDateString();
  } catch {
    return "—";
  }
}
