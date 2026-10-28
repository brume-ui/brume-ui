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
});
