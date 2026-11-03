import { Alert, useBrume } from '@brume-ui/brume-react';
import { useState } from 'react';
export interface SummaryError {
  path: string;
  messages: readonly string[];
  label?: string;
  target?: string;
}
/** How many fields the summary names before collapsing the rest behind 「還有 N 項」. */
const VISIBLE = 3;
export function ErrorSummary({
  id,
  errors,
  onFocus,
}: {
  id: string;
  errors: SummaryError[];
  onFocus(path: string): void;
}) {
  const { t } = useBrume();
  const [expanded, setExpanded] = useState(false);
  if (!errors.length) return null;
  const shown = expanded ? errors : errors.slice(0, VISIBLE);
  const hidden = errors.length - shown.length;
  return (
    <Alert
      tone="danger"
      id={id}
      tabIndex={-1}
      title={t('form.errorSummary', { count: errors.length })}
    >
      {/* Field names only (messages are sr-only): each field shows its own message. */}
      <ul className="br:flex br:flex-wrap br:gap-x-3 br:gap-y-1">
        {shown.map((error) => (
          <li key={error.path}>
            {error.target ? (
              <a
                href={`#${error.target}`}
                onClick={(event) => {
                  event.preventDefault();
                  onFocus(error.path);
                }}
              >
                {error.label ? (
                  <>
                    {error.label}
                    {/* The message stays in the link's name for screen readers; sighted users read it at the field. */}
                    <span className="br:sr-only">
                      {t('form.errorSeparator')} {error.messages.join('、')}
                    </span>
                  </>
                ) : (
                  error.messages.join('、')
                )}
              </a>
            ) : (
              error.messages.join('、')
            )}
          </li>
        ))}
        {hidden > 0 ? (
          <li>
            <button type="button" onClick={() => setExpanded(true)}>
              {t('form.errorMore', { count: hidden })}
            </button>
          </li>
        ) : null}
      </ul>
    </Alert>
  );
}
