export const ThemePreference = {
  Light: "light",
  Dark: "dark",
  System: "system",
} as const;
export type ThemePreference = (typeof ThemePreference)[keyof typeof ThemePreference];

export type ResolvedTheme = typeof ThemePreference.Light | typeof ThemePreference.Dark;

export const THEME_STORAGE_KEY = "sut-theme";

/** Browser chrome colour per theme, from the design system. */
export const THEME_COLOR: Record<ResolvedTheme, string> = {
  light: "#58286e",
  dark: "#16101a",
};

export function isThemePreference(value: unknown): value is ThemePreference {
  return Object.values(ThemePreference).includes(value as ThemePreference);
}

/**
 * Runs inline in <head> before first paint, so the page never flashes the wrong theme.
 * Kept dependency-free and tiny; it mirrors resolveTheme() below.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var p=localStorage.getItem("${THEME_STORAGE_KEY}");var d=p==="dark"||((p===null||p==="system")&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light";}catch(e){document.documentElement.dataset.theme="light";}})();`;

export function resolveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): ResolvedTheme {
  if (preference === ThemePreference.System) {
    return systemPrefersDark ? ThemePreference.Dark : ThemePreference.Light;
  }
  return preference;
}
