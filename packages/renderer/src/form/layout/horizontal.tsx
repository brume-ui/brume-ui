import type { ReactNode } from 'react';
export function Horizontal({ children }: { children: ReactNode }) {
  return <div className="br:grid br:grid-cols-1 br:gap-4">{children}</div>;
}
