import type { ReactNode } from 'react';

export function Page(props: { name: string; title: string; lead?: string; children: ReactNode }) {
  return (
    <main className="pg-page" data-testid={`pg-${props.name}`}>
      <h1>{props.title}</h1>
      {props.lead ? <p className="pg-lead">{props.lead}</p> : null}
      {props.children}
    </main>
  );
}

export function Section(props: { title: string; children: ReactNode }) {
  return (
    <section className="pg-section">
      <h2>{props.title}</h2>
      {props.children}
    </section>
  );
}

export function Panel({ children }: { children: ReactNode }) {
  return <div className="pg-panel">{children}</div>;
}
