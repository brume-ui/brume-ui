import { Card, PageHeader } from '@herb09638/brume-react';
import type { DashboardPage } from '@herb09638/brume-schema';
import { ComponentSlot } from './component-slot';

export function DashboardPageView({ page }: { page: DashboardPage }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <PageHeader title={page.title} />
      <div
        style={{
          display: 'grid',
          gap: '16px',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 18rem), 1fr))',
        }}
      >
        {page.blocks.map((block, i) =>
          block.type === 'card' ? (
            // biome-ignore lint/suspicious/noArrayIndexKey: blocks have no ids
            <Card key={i} title={block.title}>
              {block.body}
            </Card>
          ) : (
            // biome-ignore lint/suspicious/noArrayIndexKey: blocks have no ids
            <ComponentSlot key={i} ref={block} />
          ),
        )}
      </div>
    </div>
  );
}
