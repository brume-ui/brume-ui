import { cloneElement, type ReactElement, useId, useRef } from 'react';
import { cn } from '../cn';

const CAPTION = 'br:text-sm br:font-semibold br:text-text';

const DROP_IN = 'br:animate-[br-drop-in_var(--br-duration-base)_var(--br-ease-out)]';

export interface FieldProps {
  label: string;
  description?: string;
  error?: string;
  required?: boolean;
  /**
   * The child is a group (RadioGroup, CheckboxGroup, RangeInput), which a `<label for>` cannot
   * name: the caption becomes plain text and the group points at it with `aria-labelledby`.
   */
  group?: boolean;
  children: ReactElement<Record<string, unknown>>;
}

export function Field({ label, description, error, required, group, children }: FieldProps) {
  const autoId = useId();
  // The hint present on first render is part of the page; one that appears or changes later drops in.
  const initialDescription = useRef(description);
  const id = (children.props.id as string | undefined) ?? autoId;
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const labelId = `${id}-label`;
  const describedBy =
    [children.props['aria-describedby'] as string | undefined, descriptionId, errorId]
      .filter(Boolean)
      .join(' ') || undefined;
  const injected: Record<string, unknown> = { id };
  if (describedBy) injected['aria-describedby'] = describedBy;
  if (error) injected['aria-invalid'] = true;
  if (required) injected['aria-required'] = true;
  if (group) injected['aria-labelledby'] = labelId;
  const caption = (
    <>
      {label}
      {required ? (
        <span aria-hidden="true" className="br:text-danger">
          {' *'}
        </span>
      ) : null}
    </>
  );

  return (
    <div className="br:flex br:flex-col br:gap-1.5">
      {group ? (
        <span id={labelId} className={CAPTION}>
          {caption}
        </span>
      ) : (
        <label htmlFor={id} className={CAPTION}>
          {caption}
        </label>
      )}
      {description ? (
        <p
          key={description}
          id={descriptionId}
          className={cn(
            'br:text-sm br:text-text-muted',
            description !== initialDescription.current && DROP_IN,
          )}
        >
          {description}
        </p>
      ) : null}
      {cloneElement(children, injected)}
      {error ? (
        // Keyed by the message so each new error drops in again (fade-only under reduced motion).
        <p key={error} id={errorId} className={cn('br:text-sm br:text-danger', DROP_IN)}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
