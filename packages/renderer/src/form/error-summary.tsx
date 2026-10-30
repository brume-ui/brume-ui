import { Alert, useBrume } from '@brume-ui/brume-react';
export interface SummaryError {
  path: string;
  messages: readonly string[];
  label?: string;
  target?: string;
}
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
  if (!errors.length) return null;
  return (
    <Alert
      tone="danger"
      id={id}
      tabIndex={-1}
      title={t('form.errorSummary', { count: errors.length })}
    >
      <ul>
        {errors.map((error) => (
          <li key={error.path}>
            {error.target ? (
              <a
                href={`#${error.target}`}
                onClick={(event) => {
                  event.preventDefault();
                  onFocus(error.path);
                }}
              >
                {error.label}: {error.messages.join('、')}
              </a>
            ) : (
              error.messages.join('、')
            )}
          </li>
        ))}
      </ul>
    </Alert>
  );
}
