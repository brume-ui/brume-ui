import { expect, it } from 'vitest';
import { scopeErrors, unclaimedErrors } from './errors';

const errors = {
  images: ['images'],
  'images.2.extra.link': ['link'],
  imagesX: ['other'],
  sku: ['sku'],
  skux: ['skux'],
  total: ['total'],
};
it('keeps only the prefix and makes keys relative', () => {
  expect(scopeErrors(errors, 'images')).toEqual({ '': ['images'], '2.extra.link': ['link'] });
  expect(scopeErrors(errors, '')).toEqual(errors);
  expect(scopeErrors(errors, 'missing')).toEqual({});
});
it('keeps errors without a field as unclaimed', () => {
  expect(unclaimedErrors(errors, ['sku', 'images'])).toEqual({
    imagesX: ['other'],
    skux: ['skux'],
    total: ['total'],
  });
  expect(unclaimedErrors({ '': ['global'] }, ['sku'])).toEqual({ '': ['global'] });
  expect(unclaimedErrors(errors, [''])).toEqual({});
});
