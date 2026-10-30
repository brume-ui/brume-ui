import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { addressRegistry } from '../../../apps/playground/src/pages/custom-address';
import { FormRepeatersPage } from '../../../apps/playground/src/pages/form-repeaters';
import { renderWithBrume } from './test-utils';

describe('public address example', () => {
  it('renders one registration in the actual repeater, handles relative errors and updates its display', () => {
    expect(addressRegistry.getField('TaiwanAddress')?.inlineEditable).toBe(false);
    expect(addressRegistry.getField('Address')).toBeUndefined();
    renderWithBrume(<FormRepeatersPage />);
    const county = screen.getByDisplayValue('Taipei');
    const group = county.closest('li');
    expect(group).toBeTruthy();
    expect(within(group as HTMLLIElement).getByLabelText('Zip code')).toBeTruthy();
    expect(screen.getByText('100, Taipei, Zhongzheng, 1 Example Road')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Show address error' }));
    expect(county.getAttribute('aria-invalid')).toBe('true');
    expect(
      document.getElementById(county.getAttribute('aria-describedby') ?? '')?.textContent,
    ).toBe('Check the delivery county.');
    fireEvent.change(county, { target: { value: 'Taichung' } });
    expect(screen.queryByText('Check the delivery county.')).toBeNull();
    expect(screen.getByText('100, Taichung, Zhongzheng, 1 Example Road')).toBeTruthy();
    expect(
      JSON.parse(screen.getByTestId('repeater-values').textContent ?? '{}').groups[0].address,
    ).toEqual({
      zipcode: '100',
      county: 'Taichung',
      district: 'Zhongzheng',
      address: '1 Example Road',
    });
  });
});
