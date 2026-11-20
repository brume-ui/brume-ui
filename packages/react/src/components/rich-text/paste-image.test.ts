import { describe, expect, it } from 'vitest';
import { isSingleImageHtml } from './paste-image';

describe('isSingleImageHtml', () => {
  it('is true for one image, with wrappers, meta, comments and whitespace around it', () => {
    expect(isSingleImageHtml('<img src="a.png">')).toBe(true);
    expect(
      isSingleImageHtml(
        '<html><head><meta charset="utf-8"><style>p{}</style></head><body>\n<!--StartFragment--><p>&nbsp;<img src="x"></p><!--EndFragment--></body></html>',
      ),
    ).toBe(true);
  });

  it('is false for office HTML (tables, text) and for several images', () => {
    expect(isSingleImageHtml('<table><tr><td>A1</td><td>B1</td></tr></table>')).toBe(false);
    expect(isSingleImageHtml('<p>說明</p><img src="a.png">')).toBe(false);
    expect(isSingleImageHtml('<img src="a"><img src="b">')).toBe(false);
    expect(isSingleImageHtml('')).toBe(false);
  });
});
