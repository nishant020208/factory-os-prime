import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type ThemeMode = "dark" | "light" | "aesthetic";

interface ThemeCtx {
  theme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
  resolved: "dark" | "light"; // what the browser sees for native UI
}

const ThemeContext = createContext<ThemeCtx>({
  theme: "dark",
  setTheme: () => {},
  resolved: "dark",
});

const STORAGE_KEY = "factoryos-theme";

function getInitial(): ThemeMode {
  if (typeof window === "undefined") return "dark";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "aesthetic" || stored === "dark") return stored;
  return "dark";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(getInitial);

  useEffect(() => {
    const root = document.documentElement;
    // Remove any previous data-theme and .light class
    root.removeAttribute("data-theme");
    root.classList.remove("light");
    // Apply the new theme
    if (theme === "light") {
      root.setAttribute("data-theme", "light");
      root.classList.add("light"); // keep backward compat with existing .light selectors
    } else {
      root.setAttribute("data-theme", theme);
    }
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const setTheme = (t: ThemeMode) => setThemeState(t);

  const resolved: "dark" | "light" = theme === "light" ? "light" : "dark";

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolved }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
