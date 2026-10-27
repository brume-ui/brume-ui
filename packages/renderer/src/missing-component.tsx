import { useBrume } from '@brume-ui/brume-react';
import { useRegistry } from './registry-context';

export function MissingComponent({ name }: { name: string }) {
  const { t } = useBrume();
  const { mode } = useRegistry();
  const key = mode === 'vite' ? 'renderer.missing.vite' : 'renderer.missing.precompiled';
  return (
    <div
      role="alert"
      className="br:rounded-card br:border br:border-danger br:bg-surface br:px-4 br:py-3 br:text-sm br:text-danger"
    >
      {t(key, { name })}
    </div>
  );
}
