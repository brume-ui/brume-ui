import { type DashboardPage, SCHEMA_VERSION } from '@brume-ui/brume-schema';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BrumePageView } from './render-page';
import { renderWithBrume } from './test-utils';

const dashboard: DashboardPage = { type: 'dashboard', title: 'Overview', blocks: [] };

describe('BrumePageView', () => {
  it('dispatches by page type', () => {
    renderWithBrume(<BrumePageView envelope={{ schemaVersion: '0.1.0', page: dashboard }} />);
    expect(screen.getByRole('heading', { name: 'Overview' })).toBeTruthy();
  });

  it('dispatches error pages to ErrorPageView', () => {
    renderWithBrume(
      <BrumePageView
        envelope={{
          schemaVersion: '0.2.0',
          page: { type: 'error', status: 403, title: '沒有權限', message: '請聯絡管理員。' },
        }}
      />,
    );
    expect(screen.getByRole('heading', { name: '沒有權限' })).toBeTruthy();
  });

  it('accepts other 0.x versions', () => {
    renderWithBrume(<BrumePageView envelope={{ schemaVersion: '0.2.0', page: dashboard }} />);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('schemaVersion 1.0.0 shows a version error instead of rendering', () => {
    renderWithBrume(<BrumePageView envelope={{ schemaVersion: '1.0.0', page: dashboard }} />);
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('1.0.0');
    expect(alert.textContent).toContain(SCHEMA_VERSION);
    expect(screen.queryByRole('heading', { name: 'Overview' })).toBeNull();
  });
});
