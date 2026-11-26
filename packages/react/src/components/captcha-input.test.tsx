import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createMemoryAdapter } from '../memory-adapter';
import { BrumeProvider } from '../provider';
import { CaptchaInput, type CaptchaInputProps } from './captcha-input';

function Harness(props: Partial<CaptchaInputProps>) {
  const { onChange, ...rest } = props;
  const [value, setValue] = useState('');
  return (
    <BrumeProvider adapter={createMemoryAdapter()}>
      <CaptchaInput
        label="驗證碼"
        src="/captcha/default"
        refreshKey={0}
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

const img = () => screen.getByRole('img', { name: '驗證圖片' }) as HTMLImageElement;

describe('CaptchaInput', () => {
  it('renders an image with a translated alt and a hardened text box', () => {
    render(<Harness />);
    expect(img().getAttribute('src')).toBe('/captcha/default?r=0');
    const box = screen.getByRole('textbox', { name: '驗證碼' });
    expect(box.getAttribute('autocomplete')).toBe('off');
    expect(box.getAttribute('autocapitalize')).toBe('off');
    expect(box.getAttribute('spellcheck')).toBe('false');
  });

  it('reserves a fixed box so the row does not shift while loading', () => {
    render(<Harness />);
    expect(img().getAttribute('width')).toBe('120');
    expect(img().getAttribute('height')).toBe('36');
    expect(img().draggable).toBe(false);
    expect(img().className).toContain('br:object-contain');
  });

  it('appends with & when src already has a query string, and keeps the hash last', () => {
    const { unmount } = render(<Harness src="/c?config=flat" />);
    expect(img().getAttribute('src')).toBe('/c?config=flat&r=0');
    unmount();
    render(<Harness src="/c?x=1#frag" />);
    expect(img().getAttribute('src')).toBe('/c?x=1&r=0#frag');
  });

  it('replaces an existing r parameter instead of duplicating it', () => {
    render(<Harness src="/c?r=9&a=1" />);
    expect(img().getAttribute('src')).toBe('/c?a=1&r=0');
  });

  it('refresh changes the image url and clears nothing', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const box = screen.getByRole('textbox', { name: '驗證碼' }) as HTMLInputElement;
    fireEvent.change(box, { target: { value: 'ab12' } });
    onChange.mockClear();
    fireEvent.click(screen.getByRole('button', { name: '重新取得驗證圖片' }));
    expect(img().getAttribute('src')).toBe('/captcha/default?r=1');
    expect(box.value).toBe('ab12');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('reloads the image when refreshKey changes', () => {
    const el = (k: number) => (
      <BrumeProvider adapter={createMemoryAdapter()}>
        <CaptchaInput label="驗證碼" src="/c" refreshKey={k} value="" onChange={() => {}} />
      </BrumeProvider>
    );
    const { rerender } = render(el(0));
    expect(img().getAttribute('src')).toBe('/c?r=0');
    rerender(el(1));
    expect(img().getAttribute('src')).toBe('/c?r=1');
    rerender(el(1));
    expect(img().getAttribute('src')).toBe('/c?r=1');
  });

  it('disables the box and the refresh button; forwards onBlur', () => {
    const onBlur = vi.fn();
    render(<Harness disabled onBlur={onBlur} />);
    expect((screen.getByRole('textbox', { name: '驗證碼' }) as HTMLInputElement).disabled).toBe(
      true,
    );
    expect(
      (screen.getByRole('button', { name: '重新取得驗證圖片' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    fireEvent.blur(screen.getByRole('textbox', { name: '驗證碼' }));
    expect(onBlur).toHaveBeenCalledTimes(1);
  });
});
