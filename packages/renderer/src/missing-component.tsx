import { Alert, useBrume } from '@brume-ui/brume-react';
import { useRegistry } from './registry-context';

export function MissingComponent({ name }: { name: string }) {
  const { t } = useBrume();
  const { mode } = useRegistry();
  const key = mode === 'vite' ? 'renderer.missing.vite' : 'renderer.missing.precompiled';
  return <Alert tone="danger">{t(key, { name })}</Alert>;
}
