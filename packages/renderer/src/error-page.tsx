import { EmptyState, Link, useBrume } from '@brume-ui/brume-react';
import type { ErrorPage } from '@brume-ui/brume-schema';

/**
 * An error page (404, 403, 500…) as an empty state: the status code large and muted, the title as
 * the page heading, the message, and one way back (the page's own action, else 「回到首頁」 to `/`).
 * The way back is a real link whose plain click visits through the adapter.
 */
export function ErrorPageView({ page }: { page: ErrorPage }) {
  const { t } = useBrume();
  const action = page.action ?? { label: t('renderer.error.home'), url: '/' };
  return (
    <div className="br:flex br:min-h-[60vh] br:items-center br:justify-center">
      <EmptyState
        code={page.status}
        titleAs="h1"
        title={page.title}
        description={page.message}
        action={
          <Link href={action.url} variant="button" buttonVariant="primary" size="md">
            {action.label}
          </Link>
        }
      />
    </div>
  );
}
