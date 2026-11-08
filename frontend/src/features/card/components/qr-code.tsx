import { useMemo } from "react";
import { encode } from "uqr";

interface QrCodeProps {
  value: string;
  /** Spoken by screen readers; the code itself means nothing to a listener. */
  label: string;
  className?: string;
}

/**
 * Draws a QR code as one SVG path. Always dark on white with a quiet zone, whatever the theme,
 * so scanners read it in dark mode too.
 */
export function QrCode({ value, label, className }: QrCodeProps) {
  const { path, size } = useMemo(() => {
    const qr = encode(value, { ecc: "M", border: 2 });
    let d = "";
    qr.data.forEach((row, y) =>
      row.forEach((isDark, x) => {
        if (isDark) d += `M${x} ${y}h1v1h-1z`;
      }),
    );
    return { path: d, size: qr.size };
  }, [value]);

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${size} ${size}`}
      shapeRendering="crispEdges"
      className={className}
    >
      <rect width={size} height={size} fill="var(--color-white)" />
      <path d={path} fill="var(--sut-qr-ink)" />
    </svg>
  );
}
