import { describe, expect, it } from 'vitest';
import { isEmptyHtml } from './empty';

describe('isEmptyHtml', () => {
  it.each([
    ['<p>< 5</p>', false],
    ['<p>&#160;</p>', true],
    ['<p>&#xA0;</p>', true],
    ['<p>&#xa0;</p>', true],
    ['<p>&#XA0;</p>', true],
    ['<p>&NBSP;</p>', false],
    ['<p>\uFEFF</p>', false],
    ['<p>\u200B</p>', false],
    ['<p>\u2028</p>', false],
    ['<p>&ensp;</p>', false],
    ['<p>0</p>', false],
    ['<P><IMG SRC=x></P>', false],
    ['<!-- <img> --><p></p>', true],
    ['<p><span></span></p>', true],
    ['<hrx></hrx>', true],
    ['<p>\f\v\r</p>', true],
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
