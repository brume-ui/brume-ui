import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Circle } from 'lucide-react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { resolveIcon } from '../layout/menu-utils';
import { createMemoryAdapter } from '../memory-adapter';
import { BrumeProvider } from '../provider';
import { ALL_ICON_NAMES, IconGlyph, IconInput, type IconInputProps } from './icon-input';

function Harness(props: Partial<IconInputProps> & { initial?: string }) {
  const { initial = '', onChange, ...rest } = props;
  const [value, setValue] = useState(initial);
  return (
    <BrumeProvider adapter={createMemoryAdapter()}>
      <IconInput
        label="圖示"
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

const trigger = () => screen.getByRole('button', { name: '圖示：選擇圖示' });
const open = () => fireEvent.click(trigger());
const grid = () => screen.getByRole('group', { name: '圖示清單' });
const iconButtons = () => [...grid().querySelectorAll('button')];
const search = () => screen.getByRole('searchbox', { name: '搜尋圖示' });
const flush = () => act(async () => {});

describe('icon names', () => {
  it('every generated name is a valid name that resolves to a real icon, not the fallback', () => {
    expect(ALL_ICON_NAMES.length).toBeGreaterThan(1000);
    expect(new Set(ALL_ICON_NAMES).size).toBe(ALL_ICON_NAMES.length);
    const bad = ALL_ICON_NAMES.filter(
      (n) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(n) || n.length > 64 || resolveIcon(n) === Circle,
    );
    // `circle` itself is a real icon that happens to be the fallback component.
    expect(bad.filter((n) => n !== 'circle')).toEqual([]);
  });

  it('round-trips names with digits', () => {
    expect(ALL_ICON_NAMES).toContain('grid-3x3');
    expect(ALL_ICON_NAMES).toContain('grid-2x2-check');
  });
});

describe('IconInput', () => {
  it('keeps typed names, including unknown ones, and shows the fallback glyph', () => {
    const onChange = vi.fn();
    render(<Harness initial="home" onChange={onChange} />);
    fireEvent.change(screen.getByRole('textbox', { name: '圖示' }), {
      target: { value: 'no-such-icon' },
    });
    expect(onChange).toHaveBeenLastCalledWith('no-such-icon');
    expect((screen.getByRole('textbox', { name: '圖示' }) as HTMLInputElement).value).toBe(
      'no-such-icon',
    );
    expect(trigger().querySelector('svg')).not.toBeNull();
  });

  it('renders at most 120 buttons for an empty search and notes the cap', async () => {
    render(<Harness />);
    open();
    await flush();
    expect(iconButtons()).toHaveLength(120);
    expect(screen.getByText('僅顯示前 120 個圖示，請縮小搜尋範圍。')).toBeTruthy();
  });

  it('filters by substring over kebab names', async () => {
    render(<Harness />);
    open();
    fireEvent.change(search(), { target: { value: 'grid-3' } });
    await waitFor(() => expect(iconButtons().length).toBeGreaterThan(0));
    await waitFor(() => {
      const names = iconButtons().map((b) => b.getAttribute('aria-label') ?? '');
      expect(names.length).toBeGreaterThan(0);
      expect(names.every((n) => n.includes('grid-3'))).toBe(true);
    });
    expect(screen.queryByText(/請縮小搜尋範圍/)).toBeNull();
  });

  it('shows an empty note when nothing matches', async () => {
    render(<Harness />);
    open();
    fireEvent.change(search(), { target: { value: 'zzzzzzzz' } });
    await waitFor(() => expect(screen.getByText('找不到符合的圖示。')).toBeTruthy());
  });

  it('restricts the set with `icons`', async () => {
    render(<Harness icons={['home', 'user', 'unknown-thing']} />);
    open();
    await flush();
    expect(iconButtons().map((b) => b.getAttribute('aria-label'))).toEqual([
      'home',
      'user',
      'unknown-thing',
    ]);
  });

  it('picks with a click, closes and returns focus to the trigger', async () => {
    const onChange = vi.fn();
    render(<Harness icons={['home', 'user']} onChange={onChange} />);
    open();
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'user' }));
    expect(onChange).toHaveBeenLastCalledWith('user');
    await waitFor(() => expect(screen.queryByRole('group', { name: '圖示清單' })).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger()));
  });

  it('moves with arrow keys / Home / End (roving tabindex) and picks with Enter or Space', async () => {
    const onChange = vi.fn();
    render(<Harness icons={['a', 'b', 'c', 'd']} onChange={onChange} />);
    open();
    await flush();
    const tab = () => iconButtons().map((b) => b.tabIndex);
    expect(tab()).toEqual([0, -1, -1, -1]);
    fireEvent.keyDown(iconButtons()[0] as Element, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(iconButtons()[1]);
    expect(tab()).toEqual([-1, 0, -1, -1]);
    fireEvent.keyDown(document.activeElement as Element, { key: 'End' });
    expect(document.activeElement).toBe(iconButtons()[3]);
    fireEvent.keyDown(document.activeElement as Element, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(iconButtons()[2]);
    fireEvent.keyDown(document.activeElement as Element, { key: 'Home' });
    expect(document.activeElement).toBe(iconButtons()[0]);
    fireEvent.keyDown(document.activeElement as Element, { key: 'ArrowRight' });
    fireEvent.keyDown(document.activeElement as Element, { key: 'Enter' });
    expect(onChange).toHaveBeenLastCalledWith('b');
    await waitFor(() => expect(screen.queryByRole('group', { name: '圖示清單' })).toBeNull());
    open();
    await flush();
    fireEvent.keyDown(iconButtons()[0] as Element, { key: ' ' });
    expect(onChange).toHaveBeenLastCalledWith('a');
  });

  it('ArrowDown from the search box enters the grid', async () => {
    render(<Harness icons={['a', 'b']} />);
    open();
    await flush();
    fireEvent.keyDown(search(), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(iconButtons()[0]);
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    render(<Harness icons={['a']} />);
    open();
    await flush();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('group', { name: '圖示清單' })).toBeNull());
    expect(document.activeElement).toBe(trigger());
  });

  it('disabled blocks the popover and closes an open one', async () => {
    const el = (disabled: boolean) => (
      <BrumeProvider adapter={createMemoryAdapter()}>
        <IconInput label="圖示" value="" onChange={() => {}} disabled={disabled} icons={['a']} />
      </BrumeProvider>
    );
    const { rerender } = render(el(false));
    open();
    expect(screen.queryByRole('group', { name: '圖示清單' })).not.toBeNull();
    rerender(el(true));
    expect(screen.queryByRole('group', { name: '圖示清單' })).toBeNull();
    rerender(el(false));
    expect(screen.queryByRole('group', { name: '圖示清單' })).toBeNull();
    rerender(el(true));
    expect((trigger() as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('textbox', { name: '圖示' }) as HTMLInputElement).disabled).toBe(true);
  });

  it('forwards onBlur from the text box', () => {
    const onBlur = vi.fn();
    render(<Harness onBlur={onBlur} />);
    fireEvent.blur(screen.getByRole('textbox', { name: '圖示' }));
    expect(onBlur).toHaveBeenCalledTimes(1);
  });
});

describe('IconGlyph', () => {
  it('renders a known icon and falls back for an unknown one', () => {
    const known = render(<IconGlyph name="home" className="x" />);
    expect(known.container.querySelector('svg')?.getAttribute('class')).toContain('x');
    known.unmount();
    const unknown = render(<IconGlyph name="definitely-not-an-icon" />);
    expect(unknown.container.querySelector('svg')).not.toBeNull();
  });
});
