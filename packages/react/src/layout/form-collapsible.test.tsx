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

it('every change of openSignal opens it again, however often the user collapsed it', () => {
  const view = (openSignal: number) => (
    <FormCollapsible id="f" title="T" defaultCollapsed openSignal={openSignal}>
      {body}
    </FormCollapsible>
  );
  const { rerender } = render(view(0));
  const button = screen.getByRole('button');
  // the initial value opens nothing
  expect(button.getAttribute('aria-expanded')).toBe('false');
  rerender(view(1));
  expect(button.getAttribute('aria-expanded')).toBe('true');
  fireEvent.click(button);
  expect(button.getAttribute('aria-expanded')).toBe('false');
  // an unchanged signal leaves the user in control
  rerender(view(1));
  expect(button.getAttribute('aria-expanded')).toBe('false');
  // a new value reopens it, and so does the next one
  rerender(view(2));
  expect(button.getAttribute('aria-expanded')).toBe('true');
  fireEvent.click(button);
  rerender(view(3));
  expect(button.getAttribute('aria-expanded')).toBe('true');
});

it('a non-zero openSignal on mount does not override defaultCollapsed', () => {
  render(
    <FormCollapsible id="m" title="T" defaultCollapsed openSignal={4}>
      {body}
    </FormCollapsible>,
  );
  expect(screen.getByRole('button').getAttribute('aria-expanded')).toBe('false');
});
