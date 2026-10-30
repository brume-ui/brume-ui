import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FormRepeatersPage } from '../../../apps/playground/src/pages/form-repeaters';
import { renderWithBrume } from './test-utils';

describe('public address example', () => {
  it('renders one registration in the actual repeater, handles relative errors and updates its display', () => {
    renderWithBrume(<FormRepeatersPage />);
    const city = screen.getByDisplayValue('Taipei');
    const group = city.closest('li');
    expect(group).toBeTruthy();
    expect(within(group as HTMLLIElement).getByLabelText('Country')).toBeTruthy();
    expect(screen.getByText('TW, Taipei, 100, 1 Example Road')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Show address error' }));
    expect(city.getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById(city.getAttribute('aria-describedby') ?? '')?.textContent).toBe(
      'Check the delivery city.',
    );
    fireEvent.change(city, { target: { value: 'Taichung' } });
    expect(screen.queryByText('Check the delivery city.')).toBeNull();
    expect(screen.getByText('TW, Taichung, 100, 1 Example Road')).toBeTruthy();
    expect(
      JSON.parse(screen.getByTestId('repeater-values').textContent ?? '{}').groups[0].address,
    ).toEqual({ country: 'TW', city: 'Taichung', postalCode: '100', street: '1 Example Road' });
  });
});
