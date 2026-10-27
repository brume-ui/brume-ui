import { useBrume } from '@herb09638/brume-react';
import { type PageEnvelope, SCHEMA_VERSION } from '@herb09638/brume-schema';
import { DashboardPageView } from './dashboard-page';
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
        style={{
          border: '1px solid var(--br-danger)',
          borderRadius: '12px',
          padding: '12px 16px',
          color: 'var(--br-danger)',
        }}
      >
        <p style={{ fontWeight: 600 }}>{t('renderer.version.title')}</p>
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
  return page.type === 'list' ? <ListPageView page={page} /> : <DashboardPageView page={page} />;
}
