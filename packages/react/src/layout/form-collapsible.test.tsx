import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { FormCollapsible } from './form-structure';

const body = <input aria-label="Inner" defaultValue="x" />;

it('exposes a real button header wired to a region and keeps children mounted when collapsed', () => {
  render(
    <FormCollapsible id="adv" title="Advanced" defaultCollapsed>
      {body}
    </FormCollapsible>,
  );
  const button = screen.getByRole('button', { name: 'Advanced' });
  expect(button.tagName).toBe('BUTTON');
  expect(button.getAttribute('type')).toBe('button');
  expect(button.getAttribute('aria-expanded')).toBe('false');
  const region = document.getElementById(button.getAttribute('aria-controls') as string);
  expect(region?.id).toContain('adv');
  expect(region?.hasAttribute('hidden')).toBe(true);
  const input = document.querySelector('input[aria-label="Inner"]') as HTMLInputElement;
  expect(region?.contains(input)).toBe(true);
  // hidden content is neither focusable nor announced
  expect(screen.queryByRole('textbox', { name: 'Inner' })).toBeNull();
  fireEvent.click(button);
  expect(button.getAttribute('aria-expanded')).toBe('true');
  expect(region?.hasAttribute('hidden')).toBe(false);
  expect(screen.getByLabelText('Inner')).toBe(input);
});

it('keeps typed values across collapse and expand', () => {
  render(
    <FormCollapsible id="v" title="Group">
      {body}
    </FormCollapsible>,
  );
  const input = screen.getByLabelText('Inner') as HTMLInputElement;
  fireEvent.change(input, { target: { value: 'typed' } });
  fireEvent.click(screen.getByRole('button', { name: 'Group' }));
  fireEvent.click(screen.getByRole('button', { name: 'Group' }));
  expect((screen.getByLabelText('Inner') as HTMLInputElement).value).toBe('typed');
});

it('is open by default; defaultCollapsed only sets the initial state', () => {
  const { rerender } = render(
    <FormCollapsible id="d" title="T" defaultCollapsed>
      {body}
    </FormCollapsible>,
  );
  expect(screen.getByRole('button').getAttribute('aria-expanded')).toBe('false');
  rerender(
    <FormCollapsible id="d" title="T" defaultCollapsed={false}>
      {body}
    </FormCollapsible>,
  );
  expect(screen.getByRole('button').getAttribute('aria-expanded')).toBe('false');
});

it('forceOpen opens, stays open when it goes false, and re-opens on a new rising edge', () => {
  const { rerender } = render(
    <FormCollapsible id="f" title="T" defaultCollapsed>
      {body}
    </FormCollapsible>,
  );
  const button = screen.getByRole('button');
  rerender(
    <FormCollapsible id="f" title="T" defaultCollapsed forceOpen>
      {body}
    </FormCollapsible>,
  );
  expect(button.getAttribute('aria-expanded')).toBe('true');
  rerender(
    <FormCollapsible id="f" title="T" defaultCollapsed forceOpen={false}>
      {body}
    </FormCollapsible>,
  );
  expect(button.getAttribute('aria-expanded')).toBe('true');
  fireEvent.click(button);
  expect(button.getAttribute('aria-expanded')).toBe('false');
  rerender(
    <FormCollapsible id="f" title="T" defaultCollapsed forceOpen>
      {body}
    </FormCollapsible>,
  );
  expect(button.getAttribute('aria-expanded')).toBe('true');
});

it('starts open when forceOpen is true on mount even if defaultCollapsed', () => {
  render(
    <FormCollapsible id="m" title="T" defaultCollapsed forceOpen>
      {body}
    </FormCollapsible>,
  );
  expect(screen.getByRole('button').getAttribute('aria-expanded')).toBe('true');
});
