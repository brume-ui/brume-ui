import type { ReactNode } from 'react';
export function FormHeading({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="br:text-lg br:font-semibold br:text-text">
      {children}
    </h2>
  );
}
export function FormDivider({ label }: { label?: string }) {
  return label ? (
    <div className="br:flex br:items-center br:gap-3 br:text-sm br:text-text-muted">
      <hr className="br:flex-1 br:border-border" />
      <span>{label}</span>
      <hr className="br:flex-1 br:border-border" />
    </div>
  ) : (
    <hr className="br:border-border" />
  );
}
