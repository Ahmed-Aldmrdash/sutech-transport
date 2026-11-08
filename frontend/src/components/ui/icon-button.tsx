import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

const iconButtonStyles = cva(
  "inline-flex shrink-0 items-center justify-center rounded-md focus-ring transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        ghost: "text-ink hover:bg-brand-soft hover:text-ink-strong",
        secondary: "border border-line bg-surface-raised text-ink-strong hover:bg-surface-alt",
        // For the always-dark hero and purple bands, where text is white in both themes.
        onBrand: "text-white hover:bg-white/15",
      },
      size: {
        md: "size-12",
        sm: "size-10",
      },
    },
    defaultVariants: { variant: "ghost", size: "md" },
  },
);

interface IconButtonProps
  extends
    Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children">,
    VariantProps<typeof iconButtonStyles> {
  /** Required: an icon-only button must say what it does. */
  label: string;
  icon: ReactNode;
}

export function IconButton({
  label,
  icon,
  variant,
  size,
  className,
  type = "button",
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(iconButtonStyles({ variant, size }), className)}
      {...props}
    >
      <span aria-hidden="true" className="inline-flex [&_svg]:size-5">
        {icon}
      </span>
    </button>
  );
}
