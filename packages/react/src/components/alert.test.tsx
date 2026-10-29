import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Alert } from './alert';

describe('Alert', () => {
  it('is an alert by default, with an optional bold title', () => {
    render(
      <Alert tone="danger" title="版本不相容">
        <p>請更新前端套件。</p>
      </Alert>,
    );
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toBe('版本不相容請更新前端套件。');
    expect(screen.getByText('版本不相容').className).toContain('br:font-semibold');
  });

  it('can be a polite status, take an id and receive focus', () => {
    render(
      <Alert tone="info" role="status" id="summary" tabIndex={-1}>
        已儲存
      </Alert>,
    );
    const status = screen.getByRole('status');
    expect(status.id).toBe('summary');
    expect(status.tabIndex).toBe(-1);
  });

  it('maps each tone to its token colours', () => {
    const { rerender } = render(<Alert tone="danger">x</Alert>);
    const box = () => screen.getByRole('alert');
    for (const tone of ['danger', 'warning', 'info', 'success'] as const) {
      rerender(<Alert tone={tone}>x</Alert>);
      expect(box().getAttribute('data-tone')).toBe(tone);
      expect(box().className).toContain(`br:border-${tone}`);
      expect(box().className).toContain(`br:text-${tone}`);
    }
  });
});
