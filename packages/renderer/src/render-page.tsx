import { useBrume } from '@brume-ui/brume-react';
import { type PageEnvelope, SCHEMA_VERSION } from '@brume-ui/brume-schema';
import { DashboardPageView } from './dashboard-page';
import { ErrorPageView } from './error-page';
import { ListPageView } from './list-page';

/** For 0.x releases the "major" is 0 and any 0.y is accepted. */
function majorOf(version: string): string {
  return version.split('.')[0] ?? '';
}

export function BrumePageView({ envelope }: { envelope: PageEnvelope }) {
  const { t } = useBrume();
  if (majorOf(envelope.schemaVersion) !== majorOf(SCHEMA_VERSION)) {
    return (
      <div
        role="alert"
        className="br:rounded-card br:border br:border-danger br:bg-surface br:px-4 br:py-3 br:text-danger"
      >
        <p className="br:font-semibold">{t('renderer.version.title')}</p>
        <p>
          {t('renderer.version.message', {
            received: envelope.schemaVersion,
            supported: SCHEMA_VERSION,
          })}
        </p>
      </div>
    );
  }
  const { page } = envelope;
  switch (page.type) {
    case 'list':
      return <ListPageView page={page} />;
    case 'dashboard':
      return <DashboardPageView page={page} />;
    case 'error':
      return <ErrorPageView page={page} />;
    default: {
      const unknown: never = page;
      return unknown;
    }
  }
}
