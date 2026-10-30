import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createMemoryAdapter } from '../memory-adapter';
import { BrumeProvider } from '../provider';
import { Field } from './field';
import { TagsInput, type TagsInputProps } from './tags-input';

function Harness({
  initial = [],
  spy,
  ...rest
}: Omit<TagsInputProps, 'value' | 'onChange' | 'label'> & {
  initial?: string[];
  spy?(v: string[]): void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <BrumeProvider adapter={createMemoryAdapter()}>
      <TagsInput
        label="標籤"
        {...rest}
        value={value}
        onChange={(v) => {
          setValue(v);
          spy?.(v);
        }}
      />
    </BrumeProvider>
  );
}

const input = () => document.querySelector('input') as HTMLInputElement;
const type = (text: string) => fireEvent.change(input(), { target: { value: text } });
const chips = () =>
  screen.getAllByRole('button', { name: /^移除/ }).map((b) => b.getAttribute('aria-label'));

describe('TagsInput', () => {
  it('TagsInput adds on Enter and comma, ignores duplicates', () => {
    const spy = vi.fn();
    render(<Harness spy={spy} />);
    // Without suggestions it is a plain text field.
    expect(screen.getByRole('textbox', { name: '標籤' })).toBe(input());
    expect(input().placeholder).toBe('輸入後按 Enter 新增');
    type(' 新品 ');
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(spy).toHaveBeenLastCalledWith(['新品']);
    expect(input().value).toBe('');
    type('特價');
    fireEvent.keyDown(input(), { key: ',' });
    expect(spy).toHaveBeenLastCalledWith(['新品', '特價']);
    type('新品');
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(spy).toHaveBeenCalledTimes(2);
    expect(chips()).toEqual(['移除「新品」', '移除「特價」']);
  });

  it('a typed or pasted comma (also full-width) splits into tags', () => {
    const spy = vi.fn();
    render(<Harness spy={spy} />);
    type('a,b，c');
    expect(spy).toHaveBeenLastCalledWith(['a', 'b']);
    expect(input().value).toBe('c');
  });

  it('TagsInput ignores Enter while composing', () => {
    const spy = vi.fn();
    render(<Harness spy={spy} />);
    fireEvent.compositionStart(input());
    type('ㄒㄧㄣ');
    fireEvent.keyDown(input(), { key: 'Enter', isComposing: true });
    // Safari: the committing Enter arrives after compositionend with keyCode 229.
    fireEvent.compositionEnd(input(), { data: '新' });
    type('新');
    fireEvent.keyDown(input(), { key: 'Enter', keyCode: 229 });
    expect(spy).not.toHaveBeenCalled();
    expect(input().value).toBe('新');
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(spy).toHaveBeenLastCalledWith(['新']);
  });

  it('a comma typed during composition waits for compositionend', () => {
    const spy = vi.fn();
    render(<Harness spy={spy} />);
    fireEvent.compositionStart(input());
    type('甲，');
    expect(spy).not.toHaveBeenCalled();
    fireEvent.compositionEnd(input(), { data: '甲，' });
    expect(spy).toHaveBeenLastCalledWith(['甲']);
    expect(input().value).toBe('');
  });

  it('Backspace in the empty input removes the last tag', () => {
    const spy = vi.fn();
    render(<Harness initial={['a', 'b']} spy={spy} />);
    type('x');
    fireEvent.keyDown(input(), { key: 'Backspace' });
    expect(spy).not.toHaveBeenCalled();
    type('');
    fireEvent.keyDown(input(), { key: 'Backspace' });
    expect(spy).toHaveBeenLastCalledWith(['a']);
  });

  it('a chip’s ✕ removes that tag', () => {
    const spy = vi.fn();
    render(<Harness initial={['a', 'b']} spy={spy} />);
    fireEvent.click(screen.getByRole('button', { name: '移除「a」' }));
    expect(spy).toHaveBeenLastCalledWith(['b']);
  });

  it('disables the input at `max`', () => {
    render(<Harness initial={['a']} max={2} />);
    expect(input().disabled).toBe(false);
    type('b');
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(input().disabled).toBe(true);
    // The disabled input cannot keep focus: it moves to the last chip's ✕.
    const removeB = screen.getByRole('button', { name: '移除「b」' });
    expect(document.activeElement).toBe(removeB);
    fireEvent.click(removeB);
    expect(input().disabled).toBe(false);
    expect(document.activeElement).toBe(input());
  });

  it('applies maxLength to each tag: typed, split, pasted and from options', () => {
    const spy = vi.fn();
    const options = [
      { value: 'ok', label: '可' },
      { value: 'way-too-long', label: '長' },
    ];
    render(<Harness maxLength={3} options={options} spy={spy} />);
    type('abcd');
    expect(input().value).toBe('abc');
    // A paste of several tags is not cut as a whole; each piece is.
    type('abcdef,gh,ijklm');
    expect(spy).toHaveBeenLastCalledWith(['abc', 'gh']);
    expect(input().value).toBe('ijk');
    type('');
    // An option whose value is longer is neither suggested nor added by its label.
    type('長');
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(spy).toHaveBeenCalledTimes(1);
    type('可');
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(spy).toHaveBeenLastCalledWith(['abc', 'gh', 'ok']);
  });

  it('suggests options in a listbox; Enter picks the active one, free text still works', () => {
    const spy = vi.fn();
    const options = [
      { value: 'red', label: '紅' },
      { value: 'green', label: '綠' },
    ];
    render(<Harness options={options} initial={['green']} spy={spy} />);
    expect(screen.getByRole('combobox', { name: '標籤' })).toBe(input());
    type('紅');
    expect(input().getAttribute('aria-expanded')).toBe('true');
    // Already chosen values are not suggested again.
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['紅']);
    fireEvent.keyDown(input(), { key: 'ArrowDown' });
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(spy).toHaveBeenLastCalledWith(['green', 'red']);
    // A chosen option shows its label in the chip.
    expect(chips()).toEqual(['移除「綠」', '移除「紅」']);
    type('藍');
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(spy).toHaveBeenLastCalledWith(['green', 'red', '藍']);
  });

  it('takes Field’s description, error and required state', () => {
    render(
      <BrumeProvider adapter={createMemoryAdapter()}>
        <Field label="標籤" description="最多 5 個" error="至少一個" required>
          <TagsInput label="標籤" value={[]} onChange={() => {}} />
        </Field>
      </BrumeProvider>,
    );
    const el = input();
    expect(el.getAttribute('aria-invalid')).toBe('true');
    expect(el.getAttribute('aria-required')).toBe('true');
    const described = el.getAttribute('aria-describedby')?.split(' ') ?? [];
    expect(described.map((id) => document.getElementById(id)?.textContent)).toEqual([
      '最多 5 個',
      '至少一個',
    ]);
  });
});

it('prevents composing Enter from reaching native form submission and rejects excluded pasted/typed values', () => {
  const onChange = vi.fn();
  render(
    <BrumeProvider adapter={createMemoryAdapter()}>
      <form>
        <TagsInput label="Tags" value={[]} onChange={onChange} blockedValues={['taken']} />
      </form>
    </BrumeProvider>,
  );
  const input = screen.getByRole('textbox', { name: 'Tags' });
  fireEvent.compositionStart(input);
  expect(fireEvent.keyDown(input, { key: 'Enter', isComposing: true })).toBe(false);
  fireEvent.compositionEnd(input, { data: '完成' });
  fireEvent.change(input, { target: { value: 'taken' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { value: 'taken,free,' } });
  expect(onChange).toHaveBeenLastCalledWith(['free']);
});
