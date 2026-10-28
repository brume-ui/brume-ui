import { render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import { createMemoryAdapter } from '../memory-adapter';
import { BrumeProvider } from '../provider';
import { CheckboxGroup } from './checkbox-group';
import { Field } from './field';
import { RadioGroup } from './radio-group';
import { RangeInput } from './range-input';
import { Switch } from './switch';
import { TextInput } from './text-input';

const PAY = [
  { value: 'card', label: '信用卡' },
  { value: 'atm', label: 'ATM' },
];

/** The ids in an element's aria-describedby. */
const describedBy = (el: Element) => (el.getAttribute('aria-describedby') ?? '').split(' ');

describe('Field', () => {
  it('associates label with the input', () => {
    render(
      <Field label="帳號">
        <TextInput />
      </Field>,
    );
    expect(screen.getByLabelText('帳號').tagName).toBe('INPUT');
  });

  it('marks invalid and points aria-describedby at the error text', () => {
    render(
      <Field label="帳號" description="使用 Email" error="這個帳號已被使用，換一個再試。">
        <TextInput />
      </Field>,
    );
    const input = screen.getByLabelText('帳號');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const ids = (input.getAttribute('aria-describedby') ?? '').split(' ');
    const error = screen.getByText('這個帳號已被使用，換一個再試。');
    expect(ids).toContain(error.id);
    expect(ids).toContain(screen.getByText('使用 Email').id);
  });

  it('has no aria-invalid without an error', () => {
    render(
      <Field label="帳號">
        <TextInput />
      </Field>,
    );
    expect(screen.getByLabelText('帳號').hasAttribute('aria-invalid')).toBe(false);
  });

  it('keeps invalid on the child when there is no error', () => {
    render(
      <Field label="帳號">
        <TextInput invalid />
      </Field>,
    );
    expect(screen.getByLabelText('帳號').getAttribute('aria-invalid')).toBe('true');
  });

  it('merges the child aria-describedby and keeps aria-required', () => {
    render(
      <>
        <p id="hint">提示</p>
        <Field label="帳號" error="錯了" required>
          <TextInput aria-describedby="hint" aria-required />
        </Field>
      </>,
    );
    const input = screen.getByLabelText(/帳號/);
    const ids = (input.getAttribute('aria-describedby') ?? '').split(' ');
    expect(ids).toContain('hint');
    expect(ids).toContain(screen.getByText('錯了').id);
    expect(input.getAttribute('aria-required')).toBe('true');
  });

  it('drops in a hint or error that appears later, not the one present on first render', () => {
    const { rerender } = render(
      <Field label="帳號" description="使用 Email">
        <TextInput />
      </Field>,
    );
    expect(screen.getByText('使用 Email').className).not.toContain('br-drop-in');
    rerender(
      <Field label="帳號" description="至少 8 個字" error="這個帳號已被使用，換一個再試。">
        <TextInput />
      </Field>,
    );
    expect(screen.getByText('至少 8 個字').className).toContain('br-drop-in');
    expect(screen.getByText('這個帳號已被使用，換一個再試。').className).toContain('br-drop-in');
  });

  it('labels a group (radio, checkbox, range) with aria-labelledby, not a label for a div', () => {
    render(
      <Field label="付款方式" group>
        <RadioGroup
          label="付款方式"
          options={[
            { value: 'card', label: '信用卡' },
            { value: 'atm', label: 'ATM' },
          ]}
          value="card"
          onChange={() => {}}
        />
      </Field>,
    );
    const group = screen.getByRole('radiogroup', { name: '付款方式' });
    const caption = screen.getByText('付款方式');
    expect(caption.tagName).not.toBe('LABEL');
    expect(group.getAttribute('aria-labelledby')).toBe(caption.id);
    expect(group.hasAttribute('aria-label')).toBe(false);
    expect(document.querySelector(`label[for="${group.id}"]`)).toBeNull();
  });

  describe('wires the description, error and required state into group controls', () => {
    const field = (control: ReactElement<Record<string, unknown>>) =>
      render(
        <BrumeProvider adapter={createMemoryAdapter()}>
          <Field label="付款方式" description="選一種" error="請選擇付款方式" required group>
            {control}
          </Field>
        </BrumeProvider>,
      );
    const ids = () => [screen.getByText('選一種').id, screen.getByText('請選擇付款方式').id];

    it('RadioGroup: on the radiogroup', () => {
      field(<RadioGroup label="付款方式" options={PAY} value="" onChange={() => {}} />);
      const group = screen.getByRole('radiogroup', { name: /付款方式/ });
      expect(describedBy(group)).toEqual(expect.arrayContaining(ids()));
      expect(group.getAttribute('aria-invalid')).toBe('true');
      expect(group.getAttribute('aria-required')).toBe('true');
    });

    it('CheckboxGroup: description on the group, invalid on each checkbox', () => {
      field(<CheckboxGroup label="付款方式" options={PAY} value={[]} onChange={() => {}} />);
      const group = screen.getByRole('group', { name: /付款方式/ });
      expect(describedBy(group)).toEqual(expect.arrayContaining(ids()));
      for (const box of screen.getAllByRole('checkbox')) {
        expect(box.getAttribute('aria-invalid')).toBe('true');
      }
    });

    it('RangeInput: description on the group, invalid and required on both fields', () => {
      field(<RangeInput of="number" label="金額" value={{}} onChange={() => {}} />);
      const group = screen.getByRole('group', { name: /付款方式/ });
      expect(describedBy(group)).toEqual(expect.arrayContaining(ids()));
      const inputs = screen.getAllByRole('spinbutton');
      expect(inputs).toHaveLength(2);
      for (const input of inputs) {
        expect(input.getAttribute('aria-invalid')).toBe('true');
        expect(input.getAttribute('aria-required')).toBe('true');
      }
    });

    it('Switch: labelled by the field, with the error and invalid state', () => {
      render(
        <Field label="上架" error="上架前要先設定價格" required>
          <Switch label="上架" checked={false} onCheckedChange={() => {}} />
        </Field>,
      );
      const sw = screen.getByRole('switch', { name: '上架' });
      expect(describedBy(sw)).toContain(screen.getByText('上架前要先設定價格').id);
      expect(sw.getAttribute('aria-invalid')).toBe('true');
      expect(sw.getAttribute('aria-required')).toBe('true');
      expect(document.querySelector(`label[for="${sw.id}"]`)).not.toBeNull();
    });
  });

  it('leaves group controls valid without an error', () => {
    render(
      <Field label="付款方式" group>
        <RadioGroup label="付款方式" options={PAY} value="card" onChange={() => {}} />
      </Field>,
    );
    const group = screen.getByRole('radiogroup');
    expect(group.hasAttribute('aria-invalid')).toBe(false);
    expect(group.hasAttribute('aria-describedby')).toBe(false);
  });
});
