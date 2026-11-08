"use client";

import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/cn";
import { Tone } from "./tone";

type ToastTone = typeof Tone.Info | typeof Tone.Success | typeof Tone.Danger;

interface ToastOptions {
  title: string;
  description?: string;
  tone?: ToastTone;
  /** Milliseconds before it closes on its own. Errors stay longer by default. */
  durationMs?: number;
}

interface ToastItem extends Required<Omit<ToastOptions, "description">> {
  id: number;
  description?: string;
}

interface ToastContextValue {
  show: (options: ToastOptions) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION_MS = 4000;
const ERROR_DURATION_MS = 7000;
const MAX_VISIBLE = 3;

const TONE_ICON: Record<ToastTone, ReactNode> = {
  info: <Info className="text-teal" />,
  success: <CircleCheck className="text-success" />,
  danger: <CircleAlert className="text-danger-text" />,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const t = useTranslations("common");
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback(
    ({ title, description, tone = Tone.Info, durationMs }: ToastOptions) => {
      const id = nextId.current++;
      const duration =
        durationMs ?? (tone === Tone.Danger ? ERROR_DURATION_MS : DEFAULT_DURATION_MS);
      setToasts((current) =>
        [...current, { id, title, description, tone, durationMs: duration }].slice(-MAX_VISIBLE),
      );
      window.setTimeout(() => dismiss(id), duration);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-toast flex flex-col items-center gap-2 p-4 pb-[calc(env(safe-area-inset-bottom)+5rem)] desktop:items-end desktop:pb-6"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.tone === Tone.Danger ? "alert" : "status"}
            className={cn(
              "pointer-events-auto flex w-full max-w-sm animate-toast-in items-start gap-3 rounded-md border border-line bg-surface-raised p-4 shadow-lg",
            )}
          >
            <span aria-hidden="true" className="mt-0.5 inline-flex shrink-0 [&_svg]:size-5">
              {TONE_ICON[toast.tone]}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-body-sm font-bold text-ink-strong">{toast.title}</p>
              {toast.description ? (
                <p className="text-body-sm text-ink-muted">{toast.description}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label={t("close")}
              className="tap-area -me-1 -mt-1 inline-flex size-8 shrink-0 items-center justify-center rounded-sm text-ink-muted focus-ring hover:bg-surface-alt"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside <ToastProvider>.");
  return context;
}
