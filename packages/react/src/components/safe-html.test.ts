import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { safeHtmlToReact } from './safe-html';

const render = (html: string) => renderToStaticMarkup(safeHtmlToReact(html) as never);
const hrefOf = (href: string) => {
  const doc = new DOMParser().parseFromString(render(`<a href="${href}">x</a>`), 'text/html');
  return doc.querySelector('a')?.getAttribute('href') ?? null;
};

describe('safeHtmlToReact', () => {
  it.each([
    '<img src=x onerror=alert(1)>',
    '<a href="java&#10;script:alert(1)">x</a>',
    '<svg><script>alert(1)</script></svg>',
    '<style>body{display:none}</style>',
    '<p onclick="alert(1)" style="x:y" class="c" id="i">hi</p>',
    '<script>alert(1)</script>',
    '<iframe src="//evil.example"></iframe><object data=x></object><embed src=x>',
    '<template><b>t</b></template><noscript>n</noscript><math><mi>m</mi></math>',
    '<title>t</title><textarea>t</textarea><select><option>o</option></select>',
  ])('emits nothing dangerous for %s', (input) => {
    const out = render(input);
    expect(out).not.toMatch(
      /<(script|img|svg|style|iframe|object|embed|template|noscript|math|title|textarea|select|option)\b/i,
    );
    expect(out).not.toMatch(/\son[a-z]+=/i);
    expect(out).not.toMatch(/javascript:/i);
    expect(out).not.toMatch(/\s(style|id|src)=/i);
  });

  it('drops dropped elements together with their content', () => {
    expect(render('a<script>SECRET</script><style>SECRET</style><svg>SECRET</svg>b')).toBe('ab');
  });

  it.each([
    ['//evil.example', null],
    ['/\\evil.example', null],
    ['\\/evil.example', null],
    ['data:text/html,x', null],
    ['javascript:alert(1)', null],
    ['  JaVaScRiPt:alert(1)', null],
    ['java&#9;script:alert(1)', null],
    ['java&#10;script:alert(1)', null],
    ['java&#13;script:alert(1)', null],
    ['&#1;javascript:alert(1)', null],
    ['&#32;&#10;javascript:alert(1)', null],
    ['vbscript:x', null],
    ['relative/path', null],
    ['', null],
    ['/orders', '/orders'],
    ['/', '/'],
    ['https://example.com/a?b=1', 'https://example.com/a?b=1'],
    ['HTTP://example.com', 'HTTP://example.com'],
    ['mailto:a@example.com', 'mailto:a@example.com'],
    ['tel:+886223456789', 'tel:+886223456789'],
  ])('href %j -> %j', (input, expected) => {
    expect(hrefOf(input)).toBe(expected);
  });

  it('keeps the anchor without href when the href is rejected', () => {
    expect(render('<a href="//evil.example">x</a>')).toMatch(/^<a [^>]*>x<\/a>$/);
    expect(render('<a href="data:x">x</a>')).not.toContain('href');
  });

  it('keeps href and target on a link and adds rel', () => {
    const doc = new DOMParser().parseFromString(
      render('<a href="/orders" target="_blank">go</a>'),
      'text/html',
    );
    const a = doc.querySelector('a');
    expect(a?.getAttribute('href')).toBe('/orders');
    expect(a?.getAttribute('target')).toBe('_blank');
    expect(a?.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('gives every kept link rel and no target unless the source had _blank', () => {
    const doc = new DOMParser().parseFromString(
      render('<a href="/a" target="_top">a</a>'),
      'text/html',
    );
    const a = doc.querySelector('a');
    expect(a?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(a?.hasAttribute('target')).toBe(false);
  });

  it('unwraps unknown elements and keeps their children', () => {
    expect(render('<div><b>x</b></div>')).toBe('<b>x</b>');
    expect(render('<section><h1>T</h1><custom-el>y</custom-el></section>')).toBe('Ty');
  });

  it('keeps whitelisted formatting, lists and breaks', () => {
    expect(render('<p>a<br>b</p><ul><li>one</li></ul><ol><li>two</li></ol>')).toBe(
      '<p>a<br/>b</p><ul><li>one</li></ul><ol><li>two</li></ol>',
    );
    expect(
      render('<strong>s</strong><em>e</em><u>u</u><s>x</s><small>m</small><code>c</code>'),
    ).toBe('<strong>s</strong><em>e</em><u>u</u><s>x</s><small>m</small><code>c</code>');
  });

  it('does not double-escape text', () => {
    expect(render('Tom &amp; Jerry')).toBe('Tom &amp; Jerry');
    const doc = new DOMParser().parseFromString(render('Tom &amp; Jerry &lt;b&gt;'), 'text/html');
    expect(doc.body.textContent).toBe('Tom & Jerry <b>');
  });

  it('drops comments and processing instructions', () => {
    expect(render('a<!-- c --><?php echo 1 ?>b')).toBe('ab');
  });

  it('handles empty input', () => {
    expect(render('')).toBe('');
  });

  it('does not throw on 25 levels of nesting and keeps the text', () => {
    const html = `${'<span>'.repeat(25)}deep${'</span>'.repeat(25)}`;
    const out = render(html);
    expect(out).toContain('deep');
    expect((out.match(/<span>/g) ?? []).length).toBeLessThanOrEqual(20);
  });

  it('survives very deep nesting without recursion blow-up', () => {
    const html = `${'<span>'.repeat(3000)}deep${'</span>'.repeat(3000)}`;
    expect(render(html)).toContain('deep');
  });

  it('caps the node count and emits the rest as plain text without elements', () => {
    const html = `${'<b>x</b>'.repeat(5000)}<script>NO</script>`;
    const out = render(html);
    expect((out.match(/<b>/g) ?? []).length).toBeLessThanOrEqual(2000);
    expect(out).not.toContain('NO');
    expect((out.match(/x/g) ?? []).length).toBe(5000);
  });

  it('never emits dropped-element text in the over-cap remainder', () => {
    const html = `${'<i>.</i>'.repeat(2500)}<style>LEAK</style><a href="javascript:1">l</a>`;
    const out = render(html);
    expect(out).not.toContain('LEAK');
    expect(out).not.toContain('javascript');
  });
});
