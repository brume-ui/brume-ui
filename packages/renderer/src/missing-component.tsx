import { useBrume } from '@herb09638/brume-react';
import { useRegistry } from './registry-context';

const BOX = {
  border: '1px solid var(--br-danger)',
  borderRadius: '12px',
  padding: '12px 16px',
  color: 'var(--br-danger)',
  background: 'color-mix(in srgb, var(--br-danger) 8%, transparent)',
  fontSize: '0.875rem',
} as const;

export function MissingComponent({ name }: { name: string }) {
  const { t } = useBrume();
  const { mode } = useRegistry();
  const key = mode === 'vite' ? 'renderer.missing.vite' : 'renderer.missing.precompiled';
  return (
    <div role="alert" style={BOX}>
      {t(key, { name })}
    </div>
  );
}
