import { ArrowLeft } from 'lucide-react';
import {
  type AnchorHTMLAttributes,
  type MouseEventHandler,
  type ReactNode,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { buttonClasses } from '../components/button';
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
      className="br:text-base br:font-semibold br:text-text br:scroll-m-6"
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

/** A semantic card shared by standalone forms and embedded section stacks. */
export function FormSection({
  id,
  title,
  description,
  sectionKey,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  sectionKey?: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      aria-describedby={description ? `${id}-description` : undefined}
      className="br:min-w-0 br:grid br:gap-4 br:rounded-card br:border br:border-border br:bg-surface br:max-sm:p-4 br:sm:p-6"
    >
      <div className="br:grid br:gap-1">
        <FormHeading id={id} sectionKey={sectionKey}>
          {title}
        </FormHeading>
        {description ? (
          <p id={`${id}-description`} className="br:text-sm br:text-text-muted">
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/** Footer clearance tracks wrapping, zoom and localization rather than assuming a fixed height. */
export function FormPageContent({
  children,
  actions,
}: {
  children: ReactNode;
  actions: ReactNode;
}) {
  const footer = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(96);
  useLayoutEffect(() => {
    const element = footer.current;
    if (!element) return;
    const measure = () => setHeight(element.getBoundingClientRect().height || 96);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <div data-form-content="" className="br:min-w-0 br:w-full br:max-w-[880px] br:flex-1">
      <div data-form-action-clearance="" style={{ paddingBottom: height + 24 }}>
        {children}
      </div>
      <div ref={footer} className="br:sticky br:bottom-0 br:z-10">
        {actions}
      </div>
    </div>
  );
}

export function FormBackLink(props: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'className'>) {
  return (
    <a {...props} className={buttonClasses('ghost')}>
      <ArrowLeft aria-hidden="true" className="br:size-4" />
      {props.children}
    </a>
  );
}

/** Composite fields stay one semantic group, with a compact first column and a full-width final row. */
export function CompositeField({
  label,
  id,
  description,
  error,
  disabled,
  compact,
  middle,
  trailing,
  children,
  'aria-describedby': describedBy,
  'aria-invalid': invalid,
}: {
  label: string;
  id: string;
  description?: string;
  error?: string;
  disabled?: boolean;
  compact: ReactNode;
  middle: ReactNode;
  trailing: ReactNode;
  children: ReactNode;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
}) {
  const descriptions =
    [describedBy, description ? `${id}-help` : undefined, error ? `${id}-error` : undefined]
      .filter(Boolean)
      .join(' ') || undefined;
  return (
    <fieldset
      id={id}
      disabled={disabled}
      aria-describedby={descriptions}
      aria-invalid={invalid || !!error || undefined}
      className="br:min-w-0 br:rounded-input br:border br:border-border br:p-4 br:@container"
    >
      <legend className="br:px-1 br:text-sm br:font-semibold br:text-text">{label}</legend>
      {description ? (
        <p id={`${id}-help`} className="br:mb-2 br:text-sm br:text-text-muted">
          {description}
        </p>
      ) : null}
      <div className="br:grid br:gap-3 br:@max-[480px]:grid-cols-1 br:@min-[480px]:grid-cols-[6rem_minmax(0,1fr)_minmax(0,1fr)]">
        <div className="br:min-w-0">{compact}</div>
        <div className="br:min-w-0">{middle}</div>
        <div className="br:min-w-0">{trailing}</div>
        <div className="br:min-w-0 br:col-span-full">{children}</div>
      </div>
      {error ? (
        <p id={`${id}-error`} className="br:mt-2 br:text-sm br:text-danger">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
