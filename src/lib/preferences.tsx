// preferences.tsx — per-user preferences (language / theme / time format /
// notifications) persisted to profiles.preferences (jsonb) and localStorage,
// applied app-wide on every page load. `safeDate` reads the time-format via
// the module-level setter so every timestamp in the app respects it.
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useI18n, LOCALES, type Locale } from "@/lib/i18n";
import { useTheme, type ThemeMode } from "@/hooks/use-theme";
import { setAppTimeFormat, type AppTimeFormat } from "@/lib/utils";

export type TimeFormat = AppTimeFormat;
export type NotificationsPref = "all" | "important" | "none";

export interface Preferences {
  locale: Locale;
  theme: ThemeMode;
  timeFormat: TimeFormat;
  notifications: NotificationsPref;
}

const DEFAULTS: Preferences = {
  locale: "en",
  theme: "dark",
  timeFormat: "auto",
  notifications: "all",
};

// Time format is registered into the shared app-wide registry (src/lib/utils)
// so `safeDate` and every other plain-module formatter honors the preference.

interface PrefCtx {
  prefs: Preferences;
  update: (patch: Partial<Preferences>) => Promise<void>;
}

const Ctx = createContext<PrefCtx>({
  prefs: DEFAULTS,
  update: async () => {},
});

const LS_KEY = "factoryos_prefs";

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { setLocale } = useI18n();
  const { setTheme } = useTheme();
  const [prefs, setPrefs] = useState<Preferences>(() => {
    if (typeof window === "undefined") return DEFAULTS;
    try {
      const raw = window.localStorage.getItem(LS_KEY);
      if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
    } catch {}
    // One-time migration: the legacy i18n-only key held the user's language.
    // Adopt it so a previously chosen language survives the Preferences wiring.
    try {
      const legacy = window.localStorage.getItem("factoryos_locale") as Locale | null;
      if (legacy && LOCALES.some((l) => l.code === legacy)) {
        return { ...DEFAULTS, locale: legacy };
      }
    } catch {}
    return DEFAULTS;
  });

  // Persist to localStorage immediately on change + apply live effects.
  useEffect(() => {
    try {
      window.localStorage.setItem(LS_KEY, JSON.stringify(prefs));
    } catch {}
    setLocale(prefs.locale);
    setTheme(prefs.theme);
    setAppTimeFormat(prefs.timeFormat);
  }, [prefs]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load per-user prefs from the DB when a user signs in (survives devices).
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("preferences")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      const db = (data as { preferences?: Partial<Preferences> } | null)?.preferences;
      if (db && typeof db === "object") {
        const merged = { ...DEFAULTS, ...db };
        setPrefs((p) => ({ ...p, ...merged }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = async (patch: Partial<Preferences>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    try {
      window.localStorage.setItem(LS_KEY, JSON.stringify(next));
    } catch {}
    if (user) {
      await supabase
        .from("profiles")
        .update({ preferences: next as never })
        .eq("id", user.id);
    }
  };

  return <Ctx.Provider value={{ prefs, update }}>{children}</Ctx.Provider>;
}

export function usePreferences() {
  return useContext(Ctx);
}
