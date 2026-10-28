import { cn } from '../cn';
import { type IndicatorState, useHighlightIndicator } from './indicator';

export { useHighlightIndicator };

/**
 * The gliding highlight behind Radix menu/select items. Place it first inside the positioned
 * container that `useHighlightIndicator().ref` points at; items must be `relative` to sit above it.
 */
export function HighlightIndicator({
  state,
  className,
}: {
  state: IndicatorState;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      data-highlight-indicator=""
      style={state.style}
      className={cn(
        'br:pointer-events-none br:absolute br:top-0 br:left-0 br:rounded-input br:bg-surface-selected br:transition-[transform,width,height,opacity] br:duration-fast br:ease-emphasized br:motion-reduce:transition-[opacity]',
        className,
      )}
    />
  );
}
