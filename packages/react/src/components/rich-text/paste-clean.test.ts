import { describe, expect, it } from 'vitest';
import { cleanPastedHtml } from './paste-clean';

const WORD = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head><style>p.MsoNormal{mso-style-name:x}</style><meta name=Generator content="Microsoft Word"></head>
<body><!--[if gte mso 9]><xml><w:WordDocument/></xml><![endif]-->
<h2 class="MsoHeading2" style="mso-bidi-font-weight:normal">Title<o:p></o:p></h2>
<p class="MsoNormal" style="font-family:'Calibri';color:#f00;mso-fareast-language:ZH-TW"><span style="font-size:12pt"><strong>Bold</strong> and <em>italic</em></span><span style="mso-spacerun:yes"> </span><o:p>&nbsp;</o:p></p>
<ul><li class="MsoListParagraph" style="color:red">One <a href="https://example.com/a" class="x" id="y" style="color:blue">link</a></li></ul>
<table class="MsoTableGrid" border="1"><tr><td colspan="2" style="width:3cm" class="c">Cell</td></tr></table>
<p><img src="https://example.com/i.png" alt="pic" width="10" height="20" class="z" style="x:y"></p>
<p><span></span></p>
</body></html>`;

describe('cleanPastedHtml', () => {
  it('cleans Word HTML but keeps structure', () => {
    const out = cleanPastedHtml(WORD);
    expect(out).toContain('<h2>Title</h2>');
    expect(out).toContain('<strong>Bold</strong> and <em>italic</em>');
    expect(out).toContain('<ul><li>One <a href="https://example.com/a">link</a></li></ul>');
    expect(out).toContain('<td colspan="2">Cell</td>');
    expect(out).toContain('<img src="https://example.com/i.png" alt="pic" width="10" height="20">');
    for (const bad of [
      'mso',
      'Mso',
      'o:p',
      'w:',
      'class=',
      'style=',
      'font-family',
      'color',
      'id=',
      '<span',
      '<style',
      '<meta',
      '<!--',
      'xml',
    ]) {
      expect(out).not.toContain(bad);
    }
  });

  it('drops script, on* attributes, javascript: and data: links', () => {
    const out = cleanPastedHtml(
      '<p onclick="x()">a<script>alert(1)</script></p><a href="javascript:alert(1)">j</a><a href=" JavaScript:alert(1)">k</a><a href="data:text/html,x">d</a><img src="x.png" onerror="alert(1)">',
    );
    expect(out).not.toMatch(/script|onclick|onerror|javascript|data:/i);
    expect(out).toContain('<p>a</p>');
    expect(out).toContain('<img src="x.png">');
  });

  it('drops data: and file: images (images go through upload)', () => {
    const out = cleanPastedHtml(
      '<p>t<img src="data:image/png;base64,AAAA"><img src="file:///C:/a.png"></p>',
    );
    expect(out).toBe('<p>t</p>');
  });

  it('keeps the allowed inline and block set', () => {
    const html =
      '<h1>a</h1><h6>f</h6><blockquote>q</blockquote><p><u>u</u><s>s</s><sub>b</sub><sup>p</sup><b>b</b><i>i</i><br></p><hr><ol start="3"><li>x</li></ol>' +
      '<table><thead><tr><th rowspan="2">h</th></tr></thead><tbody><tr><td>c</td></tr></tbody></table><a href="/x" target="_blank" rel="noopener">l</a>';
    const out = cleanPastedHtml(html);
    for (const t of [
      '<h1>a</h1>',
      '<h6>f</h6>',
      '<blockquote>q</blockquote>',
      '<u>u</u>',
      '<s>s</s>',
      '<sub>b</sub>',
      '<sup>p</sup>',
      '<hr>',
      '<th rowspan="2">h</th>',
      '<thead>',
      '<tbody>',
      'target="_blank"',
      'rel="noopener noreferrer"',
    ]) {
      expect(out).toContain(t);
    }
    expect(out).toMatch(/<(strong|b)>b<\/(strong|b)>/);
    expect(out).toMatch(/<(em|i)>i<\/(em|i)>/);
  });

  it('unwraps empty and plain spans and font tags', () => {
    expect(
      cleanPastedHtml('<p><span><span>a</span></span><font color="red">b</font><span></span></p>'),
    ).toBe('<p>ab</p>');
  });

  it('turns inline-only div into p and unwraps div soup', () => {
    expect(cleanPastedHtml('<div class="a">text</div>')).toBe('<p>text</p>');
    expect(cleanPastedHtml('<div><div><p>x</p></div></div>')).toBe('<p>x</p>');
  });

  it('removes empty paragraphs but keeps text order', () => {
    expect(cleanPastedHtml('<p>a</p><p>&nbsp;</p><p>b</p>')).toBe('<p>a</p><p>b</p>');
  });

  it('adds rel to target=_blank links', () => {
    expect(cleanPastedHtml('<a href="https://e.com" target="_blank">x</a>')).toBe(
      '<a href="https://e.com" target="_blank" rel="noopener noreferrer">x</a>',
    );
    expect(
      cleanPastedHtml('<a href="https://e.com" target="_blank" rel="nofollow">x</a>'),
    ).toContain('noopener noreferrer');
  });

  it('keeps pre and code without attributes', () => {
    expect(cleanPastedHtml('<pre class="a"><code style="x:y">a</code></pre>')).toBe(
      '<pre><code>a</code></pre>',
    );
  });

  it('removes obfuscated javascript: links', () => {
    expect(cleanPastedHtml('<a href=" java\nscript:alert(1)">x</a>')).toBe('x');
    expect(cleanPastedHtml('<a href="&#106;avascript:alert(1)">x</a>')).toBe('x');
  });

  it('hostile markup stays inert', () => {
    expect(cleanPastedHtml('<svg><script>alert(1)</script></svg>')).not.toMatch(/script|alert/i);
    expect(
      cleanPastedHtml('<noscript><p title="</noscript><img src=x onerror=alert(1)>">'),
    ).not.toMatch(/onerror/i);
    expect(cleanPastedHtml('<template><img src=x onerror=1></template>')).not.toMatch(/onerror/i);
    expect(cleanPastedHtml('<img src=x onerror=alert(1)>')).toBe('<img src="x">');
  });

  it('converts Word mso-list paragraphs into one list', () => {
    const out = cleanPastedHtml(
      '<p class="MsoListParagraph" style="mso-list:l0 level1 lfo1"><span style="mso-list:Ignore">1.<span>&nbsp;</span></span>One</p>' +
        '<p class="MsoListParagraph" style="mso-list:l0 level1 lfo1"><span style="mso-list:Ignore">2.<span>&nbsp;</span></span>Two</p>',
    );
    expect(out).toBe('<ol><li>One</li><li>Two</li></ol>');
  });
});
