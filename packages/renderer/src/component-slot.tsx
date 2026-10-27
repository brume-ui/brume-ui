import type { ComponentRef } from '@brume-ui/brume-schema';
import { MissingComponent } from './missing-component';
import { useRegistry } from './registry-context';

export function ComponentSlot({
  ref,
  context,
}: {
  ref: ComponentRef;
  context?: Record<string, unknown>;
}) {
  const Component = useRegistry().get(ref.name);
  if (!Component) return <MissingComponent name={ref.name} />;
  return <Component {...(ref.props ?? {})} context={context} />;
}
