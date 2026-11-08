import { cva, type VariantProps } from "class-variance-authority";
import { ArrowRight } from "lucide-react";
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { Spinner } from "./spinner";

export const buttonStyles = cva(
  [
    "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-label focus-ring",
    "transition-colors duration-150 select-none",
    "disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50",
  ],
  {
    variants: {
      variant: {
        primary: "bg-brand text-on-brand hover:bg-brand-deep active:bg-brand-deep",
        secondary:
          "border border-line-strong bg-surface-raised text-ink-strong hover:bg-surface-alt active:bg-brand-soft",
        ghost: "text-brand hover:bg-brand-soft active:bg-brand-soft dark:text-brand",
        danger: "bg-danger text-on-danger hover:opacity-90 active:opacity-90",
      },
      size: {
        sm: "h-10 px-4",
        md: "h-12 px-5",
        lg: "h-14 px-6 text-body",
      },
      fullWidth: { true: "w-full" },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

type ButtonStyleProps = VariantProps<typeof buttonStyles>;

interface ButtonContentProps {
  iconStart?: ReactNode;
  iconEnd?: ReactNode;
  /** The brand's coral arrow tile, for the one main call to action on a screen. */
  withArrow?: boolean;
  children: ReactNode;
}

function ButtonContent({ iconStart, iconEnd, withArrow, children }: ButtonContentProps) {
  return (
    <>
      {iconStart}
      <span className="truncate">{children}</span>
      {iconEnd}
      {withArrow ? (
        <span
          aria-hidden="true"
          className="ms-1 -me-2 inline-flex size-7 items-center justify-center rounded-sm bg-coral text-white"
        >
          <ArrowRight className="size-4 rtl:-scale-x-100" strokeWidth={2.5} />
        </span>
      ) : null}
    </>
  );
}

interface ButtonProps
  extends
    ButtonHTMLAttributes<HTMLButtonElement>,
    ButtonStyleProps,
    Omit<ButtonContentProps, "children"> {
  /** Shows a spinner, blocks repeat presses and announces the busy state. */
  isLoading?: boolean;
}

export function Button({
  variant,
  size,
  fullWidth,
  isLoading = false,
  iconStart,
  iconEnd,
  withArrow,
  className,
  children,
  disabled,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonStyles({ variant, size, fullWidth }), className)}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      {...props}
    >
      <ButtonContent
        iconStart={isLoading ? <Spinner /> : iconStart}
        iconEnd={iconEnd}
        withArrow={withArrow && !isLoading}
      >
        {children}
      </ButtonContent>
    </button>
  );
}

interface ButtonLinkProps
  extends Omit<ComponentProps<typeof Link>, "children">, ButtonStyleProps, ButtonContentProps {}

/** A link that looks like a button. Uses the locale-aware Link. */
export function ButtonLink({
  variant,
  size,
  fullWidth,
  iconStart,
  iconEnd,
  withArrow,
  className,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link className={cn(buttonStyles({ variant, size, fullWidth }), className)} {...props}>
      <ButtonContent iconStart={iconStart} iconEnd={iconEnd} withArrow={withArrow}>
        {children}
      </ButtonContent>
    </Link>
  );
}
