import { createTranslator } from '@brume-ui/brume-react';
import type { FieldDef } from '@brume-ui/brume-schema';
import { describe, expect, it } from 'vitest';
import { builtInError, validateValue } from './validate';

const t = createTranslator('zh-TW');
const def = <T extends FieldDef['type']>(type: T, extra: Record<string, unknown> = {}): FieldDef =>
  ({ type, name: 'v', label: 'V', ...extra }) as unknown as FieldDef;
const message = (d: FieldDef, value: unknown) => validateValue(d, value, t);

describe('ip', () => {
  const ok = [
    '192.168.1.1',
    '0.0.0.0',
    '::1',
    '::',
    '2001:db8::8a2e:370:7334',
    '::ffff:192.0.2.1',
    '  10.0.0.1  ',
  ];
  const bad = [
    '256.1.1.1',
    '01.2.3.4',
    '1.2.3',
    '1::2::3',
    'fe80::1%eth0',
    '[::1]',
    '1.2.3.4/24',
    '1.2.3.4:80',
    'abc',
  ];
  it.each(ok)('accepts %j', (v) => expect(message(def('ip'), v)).toBeNull());
  it.each(bad)('rejects %j', (v) => expect(message(def('ip'), v)).toBe(t('validation.ip')));
  it('version 4 rejects every v6 form, version 6 every v4 form', () => {
    expect(message(def('ip', { version: 4 }), '::1')).toBe(t('validation.ip4'));
    expect(message(def('ip', { version: 4 }), '1.2.3.4')).toBeNull();
    expect(message(def('ip', { version: 6 }), '1.2.3.4')).toBe(t('validation.ip6'));
    expect(message(def('ip', { version: 6 }), '::ffff:192.0.2.1')).toBeNull();
  });
  it('is not checked when empty', () => {
    expect(message(def('ip'), null)).toBeNull();
    expect(message(def('ip'), '   ')).toBeNull();
  });
});

describe('slider', () => {
  const s = def('slider', { min: 0, max: 1, step: 0.1 });
  it('accepts grid values without float rejection', () => {
    for (const v of [0, 0.1, 0.3, 0.7, 1]) expect(message(s, v)).toBeNull();
  });
  it('rejects off-grid, out of bounds and non-numbers', () => {
    expect(message(s, 0.35)).toBe(t('validation.step', { step: 0.1, min: 0 }));
    expect(message(s, -1)).toBe(t('validation.min', { min: 0 }));
    expect(message(s, 2)).toBe(t('validation.max', { max: 1 }));
    expect(message(s, 'abc')).toBe(`V${t('common.hasError')}`);
  });
  it('steps are counted from min', () => {
    const d = def('slider', { min: 1, max: 10, step: 3 });
    expect(message(d, 4)).toBeNull();
    expect(message(d, 10)).toBeNull();
    expect(message(d, 5)).not.toBeNull();
  });
  it('null is empty, required reports it', () => {
    expect(message(s, null)).toBeNull();
    expect(message({ ...s, rules: [{ rule: 'required', message: 'req' }] } as FieldDef, null)).toBe(
      'req',
    );
  });
});

describe('rate', () => {
  it('checks decimals shape and honours rule bounds', () => {
    const d = def('rate', {
      decimals: 2,
      rules: [{ rule: 'max', value: 100, message: 'big' }],
    });
    expect(message(d, '12.5')).toBeNull();
    expect(message(d, '100.01')).toBe('big');
  });
});

describe('range', () => {
  const d = def('range', { decimals: 1 });
  const at = (value: unknown) => builtInError(d, value, t);
  it('accepts one bound, equal bounds and ordered bounds', () => {
    expect(at({ start: '1' })).toBeNull();
    expect(at({ end: '2.5' })).toBeNull();
    expect(at({ start: '2', end: '2.0' })).toBeNull();
    expect(at({ start: '-1.5', end: '3' })).toBeNull();
    expect(at({})).toBeNull();
    expect(at(null)).toBeNull();
  });
  it('puts the order message on end', () => {
    expect(at({ start: '3', end: '2.9' })).toEqual({
      bound: 'end',
      message: t('validation.range.order'),
    });
    expect(at({ start: '-1', end: '-2' })?.bound).toBe('end');
    expect(at({ start: '10', end: '9' })?.bound).toBe('end');
  });
  it('compares decimals exactly', () => {
    const long = (value: unknown) => builtInError(def('range', { decimals: 20 }), value, t);
    expect(long({ start: '0.30000000000000001', end: '0.3' })?.bound).toBe('end');
    expect(long({ start: '0.3', end: '0.30000000000000001' })).toBeNull();
    expect(long({ start: '9007199254740993', end: '9007199254740992' })?.bound).toBe('end');
    expect(long({ start: '0010', end: '9' })?.bound).toBe('end');
    expect(long({ start: '9', end: '0010' })).toBeNull();
    const big = (tail: string) => `1${'0'.repeat(39)}${tail}`;
    expect(long({ start: big('1'), end: big('0') })?.bound).toBe('end');
    expect(long({ start: big('0'), end: big('1') })).toBeNull();
    expect(long({ start: `-${big('1')}`, end: `-${big('2')}` })?.bound).toBe('end');
  });
  it('reports malformed and over-precise bounds on that bound', () => {
    const d2 = def('range', { decimals: 1 });
    expect(builtInError(d2, { start: 'abc' }, t)?.bound).toBe('start');
    expect(builtInError(d2, { start: '1', end: '1.25' }, t)?.bound).toBe('end');
    expect(builtInError(d2, { start: '1', end: '1.25' }, t)?.message).toBe(
      `V${t('common.hasError')}`,
    );
  });
  it('an empty object is empty for required', () => {
    const req = { ...d, rules: [{ rule: 'required', message: 'req' }] } as FieldDef;
    expect(message(req, {})).toBe('req');
    expect(message(req, { start: '1' })).toBeNull();
  });
});

describe('icon', () => {
  it.each(['star', 'arrow-down-01', 'a-large-small', 'no-longer-in-lucide'])('accepts %s', (v) =>
    expect(message(def('icon'), v)).toBeNull(),
  );
  it.each(['Star', 'a_b', '-a', 'a--b', 'a b', 'a'.repeat(65)])('rejects %j', (v) =>
    expect(message(def('icon'), v)).toBe(t('validation.icon')),
  );
  it('restricts to the list when set', () => {
    const d = def('icon', { icons: ['star', 'heart'] });
    expect(message(d, 'heart')).toBeNull();
    expect(message(d, 'cloud')).toBe(t('validation.icon'));
  });
});

describe('time', () => {
  it.each(['00:00', '09:05', '23:59', '09:05:30', '23:59:59'])('accepts %s', (v) =>
    expect(message(def('time'), v)).toBeNull(),
  );
  it.each(['24:00', '9:5', '09:5', '09:60', '09:05:60', '9:05', '0905', 'ab:cd'])(
    'rejects %s',
    (v) => expect(message(def('time'), v)).toBe(t('validation.time')),
  );
  it('timeRange checks each bound and not their order', () => {
    const d = def('timeRange');
    expect(builtInError(d, { start: '22:00', end: '06:00' }, t)).toBeNull();
    expect(builtInError(d, { start: '25:00' }, t)).toEqual({
      bound: 'start',
      message: t('validation.time'),
    });
    expect(builtInError(d, { start: '22:00', end: '9:5' }, t)?.bound).toBe('end');
  });
});
