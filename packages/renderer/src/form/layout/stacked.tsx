import type { ReactNode } from 'react';
export function Stacked({ children }: { children: ReactNode }) {
  return (
    <div className="br:grid br:grid-cols-1 br:gap-4 br:@min-[480px]:grid-cols-2 br:@min-[960px]:grid-cols-3">
      {children}
    </div>
  );
}
