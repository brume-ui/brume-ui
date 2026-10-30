import type { ReactNode } from 'react';

/** Unstyled fieldset; inert also blocks custom, non-native controls while saving. */
export function FormControls({ disabled, children }: { disabled?: boolean; children: ReactNode }) {
  return (
    <fieldset
      disabled={disabled}
      inert={disabled || undefined}
      className="br:m-0 br:min-w-0 br:border-0 br:p-0"
    >
      {children}
    </fieldset>
  );
}
