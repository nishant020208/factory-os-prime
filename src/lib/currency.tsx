// currency.tsx — ONE shared currency source for the whole app (Bug 5 fix).
//
// Every component that shows an amount should format through `fmtMoney` /
// `report-utils.money()`, which both read this module-level registry. The
// registry is populated by <CurrencyProvider/> (mounted in the authenticated
// layout) from the real `companies.currency` row, and re-populated the moment
// Company Admin changes the currency in Company Settings — so a future
// currency change never requires re-auditing individual pages.
//
// Historical records keep their ORIGINAL transaction currency (standard ERP
// practice): invoices/payments store their own `currency` column and nothing
// here rewrites old rows. The registry only controls how NEW/unspecified
// amounts render and the display symbol used app-wide.
import { createContext, useContext, useEffect, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  INR: "₹",
  JPY: "¥",
  CNY: "¥",
  CAD: "C$",
  AUD: "A$",
};

export const CURRENCY_CODES = Object.keys(CURRENCY_SYMBOLS);

let _code: string = "USD";

/** Set the app-wide display currency (company's current setting). */
export function setAppCurrency(code?: string | null) {
  if (code && CURRENCY_SYMBOLS[code]) _code = code;
}

export function getAppCurrency(): string {
  return _code;
}

export function currencySymbol(code?: string | null): string {
  const c = code || _code;
  return CURRENCY_SYMBOLS[c] ?? c;
}

/**
 * Format an amount in the app-wide currency. Pass `code` explicitly ONLY for
 * historical records that carry their own transaction currency; otherwise the
 * current company currency applies.
 */
export function fmtMoney(v: unknown, code?: string | null): string {
  const n = Number(v);
  if (!isFinite(n)) return "—";
  const symbol = currencySymbol(code);
  const c = (code && CURRENCY_SYMBOLS[code] ? code : null) ?? _code;
  const locale = c === "INR" ? "en-IN" : "en-US";
  return `${symbol}${n.toLocaleString(locale, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  })}`;
}

/**
 * Abbreviated amount in the app-wide currency — used by KPI cards,
 * chart axis labels, and stat cards where full figures would overflow.
 *
 * Branches abbreviation system based on company currency:
 *  - INR → Indian system: K (thousand), L (lakh = 100K), Cr (crore = 10M)
 *  - Others → Western system: K (thousand), M (million), B (billion)
 *
 * Rounding: 2 decimals for Cr/L/M/B, whole numbers for K, raw below 1K.
 * This is DISPLAY ONLY — never used in exports/CSV/PDF.
 */
export function fmtMoneyK(v: unknown): string {
  const n = Number(v);
  if (!isFinite(n)) return "—";
  const symbol = currencySymbol();
  const code = getAppCurrency();
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";

  if (code === "INR") {
    // Indian numbering system
    if (abs >= 1_00_00_000) {
      // Crore (10M)
      return `${sign}${symbol}${(abs / 1_00_00_000).toFixed(2).replace(/\.?0+$/, "")} Cr`;
    }
    if (abs >= 1_00_000) {
      // Lakh (100K)
      return `${sign}${symbol}${(abs / 1_00_000).toFixed(2).replace(/\.?0+$/, "")} L`;
    }
    if (abs >= 1_000) {
      // Thousand — whole number
      return `${sign}${symbol}${Math.round(abs / 1_000)}K`;
    }
    return fmtMoney(n);
  }

  // Western numbering system
  if (abs >= 1_000_000_000) {
    return `${sign}${symbol}${(abs / 1_000_000_000).toFixed(2).replace(/\.?0+$/, "")}B`;
  }
  if (abs >= 1_000_000) {
    return `${sign}${symbol}${(abs / 1_000_000).toFixed(2).replace(/\.?0+$/, "")}M`;
  }
  if (abs >= 1_000) {
    return `${sign}${symbol}${Math.round(abs / 1_000)}K`;
  }
  return fmtMoney(n);
}

/**
 * Abbreviated plain number (no currency symbol) — for chart axes,
 * quantities, and non-monetary counts. Same Indian/Western branching
 * as fmtMoneyK based on company currency.
 *
 * Rounding: 2 decimals for Cr/L/M/B, whole numbers for K, raw below 1K.
 */
export function fmtNumberShort(v: unknown): string {
  const n = Number(v);
  if (!isFinite(n)) return "—";
  const code = getAppCurrency();
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";

  if (code === "INR") {
    if (abs >= 1_00_00_000) {
      return `${sign}${(abs / 1_00_00_000).toFixed(2).replace(/\.?0+$/, "")} Cr`;
    }
    if (abs >= 1_00_000) {
      return `${sign}${(abs / 1_00_000).toFixed(2).replace(/\.?0+$/, "")} L`;
    }
    if (abs >= 1_000) {
      return `${sign}${Math.round(abs / 1_000)}K`;
    }
    return n.toLocaleString("en-IN");
  }

  if (abs >= 1_000_000_000) {
    return `${sign}${(abs / 1_000_000_000).toFixed(2).replace(/\.?0+$/, "")}B`;
  }
  if (abs >= 1_000_000) {
    return `${sign}${(abs / 1_000_000).toFixed(2).replace(/\.?0+$/, "")}M`;
  }
  if (abs >= 1_000) {
    return `${sign}${Math.round(abs / 1_000)}K`;
  }
  return n.toLocaleString("en-US");
}

interface CurrencyCtx {
  code: string;
  symbol: string;
}

const Ctx = createContext<CurrencyCtx>({ code: "USD", symbol: "$" });

/**
 * Loads the company's real currency from `companies.currency` and registers it
 * app-wide. Mount inside the authenticated layout (needs useAuth).
 */
export function CurrencyProvider({ children }: { children: ReactNode }) {
  const { companyId, user } = useAuth();

  useEffect(() => {
    if (!companyId || !user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("companies")
        .select("currency")
        .eq("id", companyId)
        .maybeSingle();
      if (cancelled) return;
      const code = (data as { currency?: string | null } | null)?.currency;
      if (code) setAppCurrency(code);
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, user]);

  return (
    <Ctx.Provider value={{ code: getAppCurrency(), symbol: currencySymbol() }}>
      {children}
    </Ctx.Provider>
  );
}

export function useCurrency() {
  return useContext(Ctx);
}
