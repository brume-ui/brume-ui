import { describe, expect, it } from 'vitest';
import { altFromFileName, isSingleImageHtml } from './paste-image';

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

  it('is not confused by ">" inside a quoted attribute', () => {
    expect(isSingleImageHtml('<p data-x="a>b"><img alt="1 > 0" src="a.png"></p>')).toBe(true);
    expect(isSingleImageHtml("<img alt='x>y' src=a.png>")).toBe(true);
    expect(isSingleImageHtml('<img alt="x>y" src="a.png"> text')).toBe(false);
  });
});

describe('altFromFileName', () => {
  it('is the file name without its extension, or empty', () => {
    expect(altFromFileName('冬季保養組.jpg')).toBe('冬季保養組');
    expect(altFromFileName('photo.final.PNG')).toBe('photo.final');
    expect(altFromFileName('  logo.webp ')).toBe('logo');
    expect(altFromFileName('noext')).toBe('noext');
    expect(altFromFileName('.png')).toBe('');
    expect(altFromFileName('')).toBe('');
    expect(altFromFileName(undefined)).toBe('');
  });
});
