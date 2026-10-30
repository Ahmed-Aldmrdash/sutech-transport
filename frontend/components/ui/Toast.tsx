"use client";

import { type ReactNode, createContext, useCallback, useContext, useMemo, useState } from "react";
import { cn } from "@/lib/cn";

type ToastTone = "default" | "danger";
interface ToastItem {
  id: number;
  text: string;
  tone: ToastTone;
}

const ToastContext = createContext<(text: string, tone?: ToastTone) => void>(() => undefined);

const TOAST_MS = 3500;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const show = useCallback((text: string, tone: ToastTone = "default") => {
    const id = Date.now() + Math.random();
    setItems((current) => [...current.slice(-2), { id, text, tone }]);
    setTimeout(() => setItems((current) => current.filter((item) => item.id !== id)), TOAST_MS);
  }, []);
  const value = useMemo(() => show, [show]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4">
        {items.map((item) => (
          <div
            key={item.id}
            className={cn(
              "pointer-events-auto max-w-md rounded-md px-4 py-3 text-[15px] font-bold shadow-lg",
              item.tone === "danger" ? "bg-danger text-on-danger" : "bg-ink-strong text-surface",
            )}
          >
            {item.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
