import { cn } from '../cn';

/**
 * Placeholder bar with a slow shimmer sweep (static under prefers-reduced-motion). Give it the
 * size of the content it stands in for so swapping to content does not shift the layout.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'br:block br:h-4 br:rounded-pill br:bg-border br:bg-[linear-gradient(90deg,transparent_25%,color-mix(in_oklab,var(--br-surface)_55%,transparent)_50%,transparent_75%)] br:bg-size-[200%_100%] br:animate-[br-shimmer_1.6s_linear_infinite] br:motion-reduce:animate-none',
        className,
      )}
    />
  );
}
