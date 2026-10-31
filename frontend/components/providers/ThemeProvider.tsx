"use client";

import { type ReactNode, createContext, useCallback, useContext, useEffect, useState } from "react";

export type ThemeChoice = "light" | "dark" | "system";
const STORAGE_KEY = "sutech.theme";

type Resolved = "light" | "dark";

const ThemeContext = createContext<{ choice: ThemeChoice; resolved: Resolved; setChoice: (choice: ThemeChoice) => void }>({
  choice: "system",
  resolved: "light",
  setChoice: () => undefined,
});

function apply(choice: ThemeChoice): Resolved {
  const dark = choice === "dark" || (choice === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#16101a" : "#58286e");
  return dark ? "dark" : "light";
}

/** Runs before paint (inlined in <head>) so the page never flashes the wrong theme. */
export const THEME_BOOT_SCRIPT = `(function(){try{var c=localStorage.getItem("${STORAGE_KEY}")||"system";var d=c==="dark"||(c==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light"}catch(e){}})()`;

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [choice, setChoiceState] = useState<ThemeChoice>("system");
  const [resolved, setResolved] = useState<Resolved>("light");

  useEffect(() => {
    let stored: ThemeChoice = "system";
    try {
      stored = (localStorage.getItem(STORAGE_KEY) as ThemeChoice | null) ?? "system";
    } catch {
      // Storage blocked: follow the system.
    }
    setChoiceState(stored);
    setResolved(apply(stored));
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if ((localStorage.getItem(STORAGE_KEY) ?? "system") === "system") setResolved(apply("system"));
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const setChoice = useCallback((next: ThemeChoice) => {
    setChoiceState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not persisted; still applied for this visit.
    }
    setResolved(apply(next));
  }, []);

  return <ThemeContext.Provider value={{ choice, resolved, setChoice }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
