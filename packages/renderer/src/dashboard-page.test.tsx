import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DashboardPageView } from './dashboard-page';
import { renderWithBrume } from './test-utils';

describe('DashboardPageView', () => {
  it('renders cards and a missing-component alert for unknown blocks', () => {
    renderWithBrume(
      <DashboardPageView
        page={{
          type: 'dashboard',
          title: 'Overview',
          blocks: [
            { type: 'card', title: 'Revenue', body: '1,234' },
            { type: 'component', name: 'Chart' },
          ],
        }}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Overview' })).toBeTruthy();
    expect(screen.getByText('1,234')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('Chart');
  });
});
