import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createMemoryAdapter } from '../memory-adapter';
import { BrumeProvider } from '../provider';
import { ColorInput, type ColorInputProps } from './color-input';

function Harness(props: Partial<ColorInputProps> & { initial?: string | null }) {
  const { initial = null, onChange, ...rest } = props;
  const [value, setValue] = useState<string | null>(initial);
  return (
    <BrumeProvider adapter={createMemoryAdapter()}>
      <ColorInput
        label="品牌色"
        {...rest}
        value={value}
        onChange={(v) => {
          setValue(v);
          onChange?.(v);
        }}
      />
    </BrumeProvider>
  );
}

describe('ColorInput', () => {
  it('passes typed text up unchanged', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.change(screen.getByRole('textbox', { name: '品牌色' }), {
      target: { value: '#12345' },
    });
    expect(onChange).toHaveBeenLastCalledWith('#12345');
  });

  it('canonicalises on blur and clears an empty box to null', () => {
    const onChange = vi.fn();
    render(<Harness initial="#ABC" onChange={onChange} />);
    const input = screen.getByRole('textbox', { name: '品牌色' });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenLastCalledWith('#aabbcc');
    fireEvent.change(input, { target: { value: '  ' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('leaves invalid text alone on blur', () => {
    const onChange = vi.fn();
    render(<Harness initial="red" onChange={onChange} />);
    fireEvent.blur(screen.getByRole('textbox', { name: '品牌色' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('emits a clicked swatch and marks it pressed', () => {
    const onChange = vi.fn();
    render(<Harness swatches={['#FF0000', '#00ff00']} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: '品牌色：開啟色盤' }));
    fireEvent.click(screen.getByRole('button', { name: '#ff0000' }));
    expect(onChange).toHaveBeenLastCalledWith('#ff0000');
    expect(screen.getByRole('button', { name: '#ff0000' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(screen.getByRole('button', { name: '#00ff00' }).getAttribute('aria-pressed')).toBe(
      'false',
    );
  });

  it('shows the alpha slider only with alpha', () => {
    const { unmount } = render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: '品牌色：開啟色盤' }));
    expect(document.querySelector('.react-colorful__alpha')).toBeNull();
    expect(document.querySelector('.react-colorful__hue')).not.toBeNull();
    unmount();
    render(<Harness alpha />);
    fireEvent.click(screen.getByRole('button', { name: '品牌色：開啟色盤' }));
    expect(document.querySelector('.react-colorful__alpha')).not.toBeNull();
  });

  it('disables input and chip', () => {
    render(<Harness disabled />);
    expect(
      (screen.getByRole('button', { name: '品牌色：開啟色盤' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect((screen.getByRole('textbox', { name: '品牌色' }) as HTMLInputElement).disabled).toBe(
      true,
    );
  });

  it('closes an open panel when disabled and does not reopen when re-enabled', () => {
    const el = (disabled: boolean) => (
      <BrumeProvider adapter={createMemoryAdapter()}>
        <ColorInput label="品牌色" value={null} onChange={() => {}} disabled={disabled} />
      </BrumeProvider>
    );
    const { rerender } = render(el(false));
    fireEvent.click(screen.getByRole('button', { name: '品牌色：開啟色盤' }));
    expect(document.querySelector('.react-colorful')).not.toBeNull();
    rerender(el(true));
    expect(document.querySelector('.react-colorful')).toBeNull();
    rerender(el(false));
    expect(document.querySelector('.react-colorful')).toBeNull();
  });

  it('emits a canonical value from the real picker (hue slider driven by keyboard)', () => {
    const onChange = vi.fn();
    render(<Harness initial="#ff0000" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: '品牌色：開啟色盤' }));
    const hue = document.querySelector('.react-colorful__hue .react-colorful__interactive');
    fireEvent.keyDown(hue as Element, { key: 'ArrowRight', keyCode: 39 });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0]).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('filters invalid swatches and collapses duplicates after normalising', () => {
    render(<Harness swatches={['#FFF', '#ffffff', 'red', '#12345', '#000']} />);
    fireEvent.click(screen.getByRole('button', { name: '品牌色：開啟色盤' }));
    const group = screen.getByRole('group', { name: '預設色票' });
    const names = [...group.querySelectorAll('button')].map((b) => b.getAttribute('aria-label'));
    expect(names).toEqual(['#ffffff', '#000000']);
  });

  it('shows the empty chip for null or invalid values and the colour otherwise', () => {
    const chipFill = () =>
      screen.getByRole('button', { name: '品牌色：開啟色盤' }).querySelector('span');
    const { unmount } = render(<Harness initial={null} />);
    expect(chipFill()).toBeNull();
    unmount();
    const second = render(<Harness initial="nope" />);
    expect(chipFill()).toBeNull();
    second.unmount();
    render(<Harness initial="#ff0000" />);
    expect((chipFill() as HTMLElement).style.backgroundColor).toBe('rgb(255, 0, 0)');
  });

  it('canonicalises an 8-digit value on blur with alpha', () => {
    const onChange = vi.fn();
    render(<Harness alpha initial="#AABBCCDD" onChange={onChange} />);
    fireEvent.blur(screen.getByRole('textbox', { name: '品牌色' }));
    expect(onChange).toHaveBeenLastCalledWith('#aabbccdd');
  });

  it('leaves an 8-digit value alone on blur without alpha', () => {
    const onChange = vi.fn();
    render(<Harness initial="#aabbccdd" onChange={onChange} />);
    fireEvent.blur(screen.getByRole('textbox', { name: '品牌色' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('forwards onBlur', () => {
    const onBlur = vi.fn();
    render(<Harness onBlur={onBlur} />);
    fireEvent.blur(screen.getByRole('textbox', { name: '品牌色' }));
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape and returns focus to the chip', async () => {
    render(<Harness />);
    const chip = screen.getByRole('button', { name: '品牌色：開啟色盤' });
    fireEvent.click(chip);
    expect(document.querySelector('.react-colorful')).not.toBeNull();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    await waitFor(() => expect(document.querySelector('.react-colorful')).toBeNull());
    expect(document.activeElement).toBe(chip);
  });
});
