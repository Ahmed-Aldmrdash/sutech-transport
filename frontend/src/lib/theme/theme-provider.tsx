"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  THEME_COLOR,
  THEME_STORAGE_KEY,
  ThemePreference,
  isThemePreference,
  resolveTheme,
  type ResolvedTheme,
} from "./theme";

interface ThemeContextValue {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);
const DARK_QUERY = "(prefers-color-scheme: dark)";

function readStoredPreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(stored) ? stored : ThemePreference.System;
  } catch {
    return ThemePreference.System;
  }
}

function applyTheme(theme: ResolvedTheme): void {
  document.documentElement.dataset.theme = theme;
  document
    .querySelectorAll('meta[name="theme-color"]')
    .forEach((meta) => meta.setAttribute("content", THEME_COLOR[theme]));
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // The boot script has already set data-theme; start from "system" on the server and sync after mount.
  const [preference, setPreferenceState] = useState<ThemePreference>(ThemePreference.System);
  const [systemPrefersDark, setSystemPrefersDark] = useState(false);
  const [isSynced, setIsSynced] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(DARK_QUERY);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from browser-only state
    setPreferenceState(readStoredPreference());
    setSystemPrefersDark(media.matches);
    setIsSynced(true);
    const onChange = (event: MediaQueryListEvent) => setSystemPrefersDark(event.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const resolvedTheme = resolveTheme(preference, systemPrefersDark);

  useEffect(() => {
    // Until synced, keep what the boot script chose so the first paint never flips.
    if (isSynced) applyTheme(resolvedTheme);
  }, [isSynced, resolvedTheme]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Private mode or blocked storage: the choice lasts for this visit only.
    }
  }, []);

  const value = useMemo(
    () => ({ preference, resolvedTheme, setPreference }),
    [preference, resolvedTheme, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside <ThemeProvider>.");
  return context;
}
