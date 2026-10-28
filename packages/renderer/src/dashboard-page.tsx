import { Card, PageHeader } from '@brume-ui/brume-react';
import type { DashboardPage } from '@brume-ui/brume-schema';
import { ComponentSlot } from './component-slot';

export function DashboardPageView({ page }: { page: DashboardPage }) {
  return (
    <div className="br:flex br:flex-col br:gap-4">
      <PageHeader title={page.title} />
      <div className="br:grid br:gap-4 br:max-md:grid-cols-1 br:md:max-xl:grid-cols-2 br:xl:grid-cols-3">
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
