import { cn } from '../cn';
import { PRESS } from '../motion/classes';
import { FOCUS_RING } from './focus';

export interface ThumbnailProps {
  src: string;
  alt: string;
  /** Accessible name of the button (what a click does), e.g. 「查看第 1 張照片」. */
  label: string;
  /** Size in px. Default 40 × 40. */
  width?: number;
  height?: number;
  onClick(): void;
}

/** A small square image that opens something larger. */
export function Thumbnail({ src, alt, label, width = 40, height = 40, onClick }: ThumbnailProps) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        'br:inline-flex br:shrink-0 br:overflow-hidden br:rounded-input br:border br:border-border br:bg-surface-canvas',
        PRESS,
        FOCUS_RING,
      )}
    >
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        loading="lazy"
        className="br:block br:object-cover"
        style={{ width, height }}
      />
    </button>
  );
}
