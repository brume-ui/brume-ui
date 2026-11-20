import { describe, expect, it } from 'vitest';
import { isEmptyHtml } from './empty';

describe('isEmptyHtml', () => {
  it.each([
    [null, true],
    [undefined, true],
    ['', true],
    ['   \n\t ', true],
    ['<p><br></p>', true],
    ['<p>&nbsp;</p>', true],
    ['<div><p> </p></div>', true],
    ['<p>\u00a0</p><!-- note --><p><br/></p>', true],
    ['<p><img src="x"></p>', false],
    ['<hr>', false],
    ['<iframe src="https://example.com"></iframe>', false],
    ['<table><tr><td></td></tr></table>', false],
    ['<p><input type="checkbox"></p>', false],
    ['a', false],
    ['<p>&nbsp;a</p>', false],
  ])('%j -> %s', (html, expected) => {
    expect(isEmptyHtml(html)).toBe(expected);
  });
});
