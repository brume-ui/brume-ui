import { cn } from '../cn';

/** Placeholder bar. Shimmer is dropped under prefers-reduced-motion. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'br:block br:h-4 br:rounded-pill br:bg-border br:animate-pulse br:motion-reduce:animate-none',
        className,
      )}
    />
  );
}
