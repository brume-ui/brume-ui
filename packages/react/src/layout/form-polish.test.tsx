import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { CompositeField, FormBackLink, FormPageContent, FormSection } from './form-structure';

it('names section cards and associates their description', () => {
  render(
    <FormSection id="basic" title="Basic" description="Details">
      Fields
    </FormSection>,
  );
  const region = screen.getByRole('region', { name: 'Basic' });
  expect(region.getAttribute('aria-describedby')).toBe('basic-description');
  expect(screen.getByText('Details').id).toBe('basic-description');
});
it('keeps page actions inside the bounded content column with reserved clearance', () => {
  const { container } = render(
    <FormPageContent actions={<button type="button">Save</button>}>Last field</FormPageContent>,
  );
  expect(container.querySelector('[data-form-action-clearance]')).not.toBeNull();
  expect(
    (container.querySelector('[data-form-content]') as HTMLElement).style.getPropertyValue(
      '--br-form-footer-clearance',
    ),
  ).toBe('120px');
  expect(
    screen.getByRole('button', { name: 'Save' }).closest('[data-form-content]'),
  ).not.toBeNull();
});
it('keeps the back action a real link', () => {
  render(<FormBackLink href="/items">Back</FormBackLink>);
  expect(screen.getByRole('link', { name: 'Back' }).getAttribute('href')).toBe('/items');
});

it('names a composite group and preserves child error descriptions', () => {
  render(
    <CompositeField
      label="Address"
      id="address"
      description="Delivery"
      error="Check address"
      compact={<input aria-label="Zip" />}
      middle={<input aria-label="County" />}
      trailing={<input aria-label="District" />}
    >
      <input aria-label="Street" />
    </CompositeField>,
  );
  const group = screen.getByRole('group', { name: 'Address' });
  expect(group.getAttribute('aria-describedby')).toContain('address-help');
  expect(group.getAttribute('aria-describedby')).toContain('address-error');
  expect(screen.getByRole('textbox', { name: 'Street' })).toBeTruthy();
});
