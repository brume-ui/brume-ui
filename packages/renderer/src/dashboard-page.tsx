import { Card, PageHeader } from '@herb09638/brume-react';
import type { DashboardPage } from '@herb09638/brume-schema';
import { ComponentSlot } from './component-slot';

export function DashboardPageView({ page }: { page: DashboardPage }) {
  return (
    <div className="br:flex br:flex-col br:gap-4">
      <PageHeader title={page.title} />
      <div className="br:grid br:grid-cols-1 br:gap-4 br:md:grid-cols-2 br:xl:grid-cols-3">
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
