import { type ReactNode, useSyncExternalStore } from 'react';
import { getDemoFeature, PERSISTENCE_LABELS } from '../demo-catalog';

const subscribe = (onChange: () => void) => {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
};
const hashSnapshot = () => window.location.hash;

/** Hash query state stays independent of the route registry, including same-path changes. */
export function useDemoExample(validIds: readonly string[], fallback: string): string {
  const hash = useSyncExternalStore(subscribe, hashSnapshot, () => '');
  const query = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
  const requested = new URLSearchParams(query).get('example');
  return requested && validIds.includes(requested) ? requested : fallback;
}

export function DemoGuide({ featureId, children }: { featureId: string; children: ReactNode }) {
  const feature = getDemoFeature(featureId);
  return (
    <>
      <aside className="pg-guide" aria-label="示範操作說明">
        <a href="#/">所有功能示範</a>
        {feature ? (
          <>
            <h2>{feature.title}</h2>
            <p>{PERSISTENCE_LABELS[feature.persistence]}</p>
            <h3>操作步驟</h3>
            <ol>
              {feature.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <p>
              <strong>預期結果：</strong>
              {feature.expected}
            </p>
          </>
        ) : (
          <p role="status">找不到功能說明，仍可操作下方範例。</p>
        )}
      </aside>
      {children}
    </>
  );
}
