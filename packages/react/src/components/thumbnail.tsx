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

/**
 * A small image that opens something larger. In a row of thumbnails it may shrink (down to 24px
 * wide, the image cropped to fit) so a narrow cell still shows all of them.
 */
export function Thumbnail({ src, alt, label, width = 40, height = 40, onClick }: ThumbnailProps) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      style={{ width: width + 2, height: height + 2 }}
      className={cn(
        'br:box-border br:inline-flex br:min-w-6 br:shrink br:overflow-hidden br:rounded-input br:border br:border-border br:bg-surface-canvas',
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
        className="br:block br:size-full br:object-cover"
      />
    </button>
  );
}
