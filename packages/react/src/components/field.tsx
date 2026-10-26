import { cloneElement, type ReactElement, useId } from 'react';

export interface FieldProps {
  label: string;
  description?: string;
  error?: string;
  required?: boolean;
  children: ReactElement<Record<string, unknown>>;
}

export function Field({ label, description, error, required, children }: FieldProps) {
  const autoId = useId();
  const id = (children.props.id as string | undefined) ?? autoId;
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="br:flex br:flex-col br:gap-1.5">
      <label htmlFor={id} className="br:text-sm br:font-semibold br:text-text">
        {label}
        {required ? (
          <span aria-hidden="true" className="br:text-danger">
            {' *'}
          </span>
        ) : null}
      </label>
      {description ? (
        <p id={descriptionId} className="br:text-sm br:text-text-muted">
          {description}
        </p>
      ) : null}
      {cloneElement(children, {
        id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
        'aria-required': required || undefined,
      })}
      {error ? (
        <p id={errorId} className="br:text-sm br:text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
