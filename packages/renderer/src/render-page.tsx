import { Alert, useBrume } from '@brume-ui/brume-react';
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
      <Alert tone="danger" title={t('renderer.version.title')}>
        <p>
          {t('renderer.version.message', {
            received: envelope.schemaVersion,
            supported: SCHEMA_VERSION,
          })}
        </p>
      </Alert>
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
    case 'form':
      // 暫時不渲染：子計畫 2 Task 13 換成 FormPageView。
      return null;
    default: {
      const unknown: never = page;
      return unknown;
    }
  }
}
