import { describe, expect, test } from 'vitest';
import { type GridQuery, parseGridQuery, serializeGridQuery, withGridQuery } from './query';

describe('grid query protocol', () => {
  test('round-trips every filter shape', () => {
    const q: GridQuery = {
      sort: { key: 'amount', direction: 'desc' },
      q: '50%',
      perPage: 50,
      scope: 'vip',
      filters: {
        status: ['paid', 'shipped'],
        amount: { start: '100' },
        total: { op: 'gt', value: '9' },
        name: 'ada',
      },
    };
    expect(parseGridQuery(serializeGridQuery(q))).toEqual(q);
  });

  test('serialize omits empty values', () => {
    expect(serializeGridQuery({ filters: { a: '', b: [], c: {} } }).toString()).toBe('');
  });

  test('withGridQuery resets page and keeps foreign params and hash', () => {
    expect(withGridQuery('/admin/orders?page=3&tab=x#top', { q: 'ada' })).toBe(
      '/admin/orders?tab=x&q=ada#top',
    );
    expect(withGridQuery('/admin/orders?page=3', { page: 4 })).toBe('/admin/orders?page=4');
  });

  test('parse ignores malformed values', () => {
    expect(parseGridQuery('sort=&per_page=abc&filter[x][y][z]=1&page=-2')).toEqual({
      filters: {},
    });
  });

  test('sort=-amount parses as desc', () => {
    expect(parseGridQuery('sort=-amount').sort).toEqual({ key: 'amount', direction: 'desc' });
  });

  test('sort=amount parses as asc', () => {
    expect(parseGridQuery('sort=amount').sort).toEqual({ key: 'amount', direction: 'asc' });
  });

  test('serialize writes desc sort with a minus prefix', () => {
    const params = serializeGridQuery({ sort: { key: 'amount', direction: 'desc' }, filters: {} });
    expect(params.get('sort')).toBe('-amount');
  });

  test('parse reads bracketed filter notations', () => {
    const parsed = parseGridQuery(
      'filter[status][]=paid&filter[status][]=shipped&filter[amount][start]=1&filter[amount][end]=5',
    );
    expect(parsed.filters).toEqual({
      status: ['paid', 'shipped'],
      amount: { start: '1', end: '5' },
    });
  });

  test('serialize preserves unknown params and replaces owned ones in base', () => {
    const base = new URLSearchParams('tab=x&q=old&filter[a]=1&page=2');
    const out = serializeGridQuery({ q: 'new', filters: {} }, base);
    expect(out.toString()).toBe('tab=x&q=new');
    expect(base.toString()).toBe(new URLSearchParams('tab=x&q=old&filter[a]=1&page=2').toString());
  });

  test('withGridQuery with undefined patch value clears it and keeps other state', () => {
    expect(withGridQuery('/x?q=a&scope=vip', { q: undefined })).toBe('/x?scope=vip');
  });

  test('serialize writes literal brackets in filter keys', () => {
    expect(serializeGridQuery({ filters: { status: ['paid', 'shipped'] } }).toString()).toBe(
      'filter[status][]=paid&filter[status][]=shipped',
    );
    expect(
      serializeGridQuery({ filters: { amount: { start: '100', end: '500' } } }).toString(),
    ).toBe('filter[amount][start]=100&filter[amount][end]=500');
    expect(serializeGridQuery({ filters: { amount: { op: 'gt', value: '100' } } }).toString()).toBe(
      'filter[amount][op]=gt&filter[amount][value]=100',
    );
  });

  test('serialize keeps encoded brackets inside values', () => {
    expect(serializeGridQuery({ q: '[a]', filters: { name: '[b]' } }).toString()).toBe(
      'q=%5Ba%5D&filter[name]=%5Bb%5D',
    );
  });

  test('withGridQuery writes literal brackets', () => {
    expect(withGridQuery('/orders?tab=x', { filters: { status: 'paid' } })).toBe(
      '/orders?tab=x&filter[status]=paid',
    );
  });

  test('parse ignores prototype keys', () => {
    const parsed = parseGridQuery(
      'filter[__proto__][start]=1&filter[constructor]=x&filter[prototype][]=y&filter[ok]=1',
    );
    expect(Object.getPrototypeOf(parsed.filters)).toBeNull();
    expect(Object.keys(parsed.filters)).toEqual(['ok']);
    expect(parsed.filters.ok).toBe('1');
    expect(({} as Record<string, unknown>).start).toBeUndefined();
  });

  test('mixed forms resolve list > op+value > range > scalar', () => {
    const all = 'filter[a]=s&filter[a][start]=1&filter[a][op]=gt&filter[a][value]=2&filter[a][]=l';
    expect(parseGridQuery(all).filters.a).toEqual(['l']);
    expect(
      parseGridQuery('filter[a]=s&filter[a][start]=1&filter[a][op]=gt&filter[a][value]=2').filters
        .a,
    ).toEqual({
      op: 'gt',
      value: '2',
    });
    expect(parseGridQuery('filter[a]=s&filter[a][start]=1').filters.a).toEqual({ start: '1' });
    expect(parseGridQuery('filter[a]=s').filters.a).toBe('s');
  });
});
