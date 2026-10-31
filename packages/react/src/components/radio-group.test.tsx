import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { RadioGroup } from './radio-group';

const options = [
  { value: 'draft', label: '草稿' },
  { value: 'published', label: '上架' },
  { value: 'archived', label: '封存', disabled: true },
  { value: 'hidden', label: '隱藏' },
];

function Harness({ onChange }: { onChange(v: string): void }) {
  const [value, setValue] = useState('draft');
  return (
    <RadioGroup
      label="狀態"
      options={options}
      value={value}
      onChange={(v) => {
        setValue(v);
        onChange(v);
      }}
    />
  );
}

describe('RadioGroup', () => {
  it('is a named radiogroup and arrow keys select (skipping disabled)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    expect(screen.getByRole('radiogroup', { name: '狀態' })).toBeTruthy();
    const draft = screen.getByRole('radio', { name: '草稿' });
    expect(draft.getAttribute('aria-checked')).toBe('true');
    await user.tab();
    expect(document.activeElement).toBe(draft);
    // Radix moves focus a tick after keydown and selects only while the arrow is still down.
    const arrowRight = async () => {
      await user.keyboard('{ArrowRight>}');
      await new Promise((r) => setTimeout(r, 0));
      await user.keyboard('{/ArrowRight}');
    };
    await arrowRight();
    expect(onChange).toHaveBeenLastCalledWith('published');
    expect(screen.getByRole('radio', { name: '上架' }).getAttribute('aria-checked')).toBe('true');
    await arrowRight();
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: '隱藏' }));
    expect(onChange).toHaveBeenLastCalledWith('hidden');
    // All four arrows work in the default (horizontal) layout, as the APG radio group expects.
    const press = async (key: string) => {
      await user.keyboard(`{${key}>}`);
      await new Promise((r) => setTimeout(r, 0));
      await user.keyboard(`{/${key}}`);
    };
    await press('ArrowUp');
    expect(onChange).toHaveBeenLastCalledWith('published');
    await press('ArrowDown');
    expect(onChange).toHaveBeenLastCalledWith('hidden');
    await press('ArrowLeft');
    expect(onChange).toHaveBeenLastCalledWith('published');
    expect(screen.getByRole('radiogroup').getAttribute('aria-orientation')).toBe('horizontal');
  });

  it('selects exactly once for immediate keydown/keyup, held repeats, wrap and all four arrows', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const press = async (key: string, label: string, value: string, release = true) => {
      const source = document.activeElement as HTMLElement;
      fireEvent.keyDown(source, { key });
      if (release) fireEvent.keyUp(source, { key });
      await waitFor(() => {
        expect(document.activeElement).toBe(screen.getByRole('radio', { name: label }));
        expect(screen.getByRole('radio', { name: label }).getAttribute('aria-checked')).toBe(
          'true',
        );
      });
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenLastCalledWith(value);
      onChange.mockClear();
    };
    screen.getByRole('radio', { name: '草稿' }).focus();
    await press('ArrowRight', '上架', 'published');
    await press('ArrowRight', '隱藏', 'hidden', false);
    await press('ArrowDown', '草稿', 'draft');
    await press('ArrowLeft', '隱藏', 'hidden');
    await press('ArrowUp', '上架', 'published');
    await userEvent.tab();
    await userEvent.tab({ shift: true });
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: '上架' }));
  });

  it('leaves modified and prevented arrow events to the consumer', async () => {
    const onChange = vi.fn();
    render(
      <div
        onKeyDownCapture={(event) => {
          if (event.key === 'ArrowDown') event.preventDefault();
        }}
      >
        <Harness onChange={onChange} />
      </div>,
    );
    const source = screen.getByRole('radio', { name: '草稿' });
    source.focus();
    fireEvent.keyDown(source, { key: 'ArrowDown' });
    fireEvent.keyUp(source, { key: 'ArrowDown' });
    fireEvent.keyDown(source, { key: 'ArrowRight', ctrlKey: true });
    fireEvent.keyUp(source, { key: 'ArrowRight', ctrlKey: true });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(document.activeElement).toBe(source);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('marks orientation and selects on click', async () => {
    const onChange = vi.fn();
    render(
      <RadioGroup
        label="狀態"
        options={options}
        value=""
        onChange={onChange}
        orientation="vertical"
      />,
    );
    expect(screen.getByRole('radiogroup').getAttribute('aria-orientation')).toBe('vertical');
    await userEvent.click(screen.getByText('上架'));
    expect(onChange).toHaveBeenCalledWith('published');
  });
});
