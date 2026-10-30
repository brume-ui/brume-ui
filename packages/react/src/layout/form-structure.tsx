import type { MouseEventHandler, ReactNode } from 'react';
export function FormHeading({
  id,
  children,
  sectionKey,
}: {
  id: string;
  children: ReactNode;
  sectionKey?: string;
}) {
  return (
    <h2
      id={id}
      tabIndex={-1}
      data-form-section={sectionKey}
      className="br:text-lg br:font-semibold br:text-text"
    >
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

/** Semantic section navigation with an accessible validation indicator. */
export function FormSectionLink({
  href,
  current,
  invalid,
  errorLabel,
  onClick,
  children,
}: {
  href: string;
  current: boolean;
  invalid: boolean;
  errorLabel: string;
  onClick: MouseEventHandler<HTMLAnchorElement>;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      aria-current={current ? 'true' : undefined}
      onClick={onClick}
      className="br:flex br:items-center br:gap-2 br:py-2 br:text-text-muted br:aria-[current=true]:text-accent br:focus-visible:outline-focus-ring"
    >
      {children}
      {invalid ? (
        <>
          <span aria-hidden="true" className="br:size-2 br:rounded-full br:bg-danger" />
          <span className="br:sr-only">{errorLabel}</span>
        </>
      ) : null}
    </a>
  );
}
