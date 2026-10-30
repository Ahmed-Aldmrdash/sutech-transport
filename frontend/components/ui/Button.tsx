import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "dangerGhost" | "dangerOutline" | "teal";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-brand text-on-brand hover:bg-brand-deep",
  secondary: "bg-surface-raised text-brand border border-line-strong hover:bg-brand-soft",
  ghost: "bg-transparent text-ink hover:bg-brand-soft",
  danger: "bg-danger text-on-danger hover:opacity-90",
  dangerGhost: "bg-transparent text-danger hover:bg-danger-soft",
  dangerOutline: "bg-surface-raised text-danger border border-line-strong hover:bg-danger-soft",
  teal: "bg-teal text-on-teal hover:opacity-90",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: "md" | "sm" | "lg";
  loading?: boolean;
  icon?: ReactNode;
  block?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  block = false,
  className,
  disabled,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "label-caps inline-flex items-center justify-center gap-2 rounded-md font-bold transition-colors duration-150",
        "disabled:opacity-50",
        size === "sm" && "min-h-9 px-3 text-sm",
        size === "md" && "min-h-12 px-5 text-[15px]",
        size === "lg" && "min-h-14 px-6 text-base",
        block && "w-full",
        VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
}
