import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ComponentSlot } from './component-slot';
import { createRegistry } from './registry';
import { renderWithBrume } from './test-utils';

const Probe = (p: { label: string; context?: { row: { id: number } } }) => (
  <p>{`${p.label}:${p.context?.row.id}`}</p>
);

describe('ComponentSlot', () => {
  it('unknown component in precompiled mode shows guidance', () => {
    renderWithBrume(<ComponentSlot ref={{ type: 'component', name: 'Chart' }} />);
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('Chart');
    expect(alert.textContent).toContain('php artisan brume:install --frontend');
  });

  it('unknown component in vite mode points at components.ts', () => {
    renderWithBrume(<ComponentSlot ref={{ type: 'component', name: 'Chart' }} />, {
      registry: createRegistry({ mode: 'vite' }),
    });
    expect(screen.getByRole('alert').textContent).toContain('resources/js/brume/components.ts');
  });

  it('localizes the message', () => {
    renderWithBrume(<ComponentSlot ref={{ type: 'component', name: 'Chart' }} />, {
      locale: 'en',
    });
    expect(screen.getByRole('alert').textContent).toContain('was not found');
  });

  it('passes props and context to a registered component', () => {
    renderWithBrume(
      <ComponentSlot
        ref={{ type: 'component', name: 'Probe', props: { label: 'hi' } }}
        context={{ row: { id: 7 } }}
      />,
      { registry: createRegistry({ mode: 'vite', components: { Probe } }) },
    );
    expect(screen.getByText('hi:7')).toBeTruthy();
  });
});
