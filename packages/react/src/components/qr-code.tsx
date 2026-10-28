import { useMemo } from 'react';
import { encode } from 'uqr';

export interface QrCodeProps {
  value: string;
  /** Rendered width and height in px. Default 160. */
  size?: number;
  /** Accessible name, e.g. 「訂單 42 的 QR Code」. */
  label: string;
}

/** Quiet zone in modules (the spec asks for 4; 2 scans reliably on a white tile). */
const QUIET = 2;

/**
 * QR code as one SVG path (dark modules on white in both themes, so scanners read it).
 * Modules are drawn as 1×1 squares in a viewBox of module units, crisp at any size.
 */
export function QrCode({ value, size = 160, label }: QrCodeProps) {
  const { d, n } = useMemo(() => {
    const qr = encode(value, { ecc: 'M', border: QUIET });
    let path = '';
    qr.data.forEach((row, y) => {
      row.forEach((dark, x) => {
        if (dark) path += `M${x} ${y}h1v1h-1z`;
      });
    });
    return { d: path, n: qr.size };
  }, [value]);
  return (
    <svg
      role="img"
      aria-label={label}
      width={size}
      height={size}
      viewBox={`0 0 ${n} ${n}`}
      shapeRendering="crispEdges"
      className="br:block br:rounded-input"
    >
      <rect width={n} height={n} fill="#fff" />
      <path d={d} fill="#000" />
    </svg>
  );
}
