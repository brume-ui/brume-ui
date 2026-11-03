import type { ReactNode } from 'react';
/**
 * Fields sit on narrow auto-filled tracks (4 across a full form card): short fields (numbers,
 * dates, switches) take one track, ordinary fields two, long ones the whole row. See cellClass.
 */
export function Stacked({ children }: { children: ReactNode }) {
  return (
    // Its own container, so a cell spans two tracks only when two tracks exist (2 × 10rem + gap).
    <div className="br:@container/stack br:min-w-0">
      <div className="br:grid br:gap-x-4 br:gap-y-5 br:grid-cols-[repeat(auto-fill,minmax(min(100%,10rem),1fr))]">
        {children}
      </div>
    </div>
  );
}
