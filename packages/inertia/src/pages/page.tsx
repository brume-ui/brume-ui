import { BrumePageView } from '@brume-ui/brume-renderer';
import type { PageEnvelope } from '@brume-ui/brume-schema';
import { Head } from '@inertiajs/react';

/** Inertia component `brume/page`: renders a schema envelope inside the persistent BrumeLayout. */
export function BrumePage({ envelope }: { envelope: PageEnvelope }) {
  return (
    <>
      <Head title={envelope.page.title} />
      <BrumePageView envelope={envelope} />
    </>
  );
}
