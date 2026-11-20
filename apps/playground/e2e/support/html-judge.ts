import type { Page } from '@playwright/test';

/**
 * Port of the phase 3.2 spike's `judge.js` / `normalize.js` (docs/superpowers/phase-3-2-spike/
 * editor-compare/src/lib). Classifies a before/after HTML pair:
 * - identical: canonical DOM equal (attribute order, whitespace, style serialisation, comments ignored)
 * - harmless:  same element skeleton (after b→strong, i→em, dropping span/thead/tbody/font wrappers)
 *              and no display-relevant fact (CSS declaration, attribute, tag, text) lost
 * - loss:      anything else, with categories
 * It runs in the page (a real DOM parses both sides the same way), so `judgeHtml` is passed to
 * `page.evaluate` and must stay self-contained.
 */
export interface Judgement {
  verdict: 'identical' | 'harmless' | 'loss';
  cats: string[];
  /** Canonical forms, for a readable diff on failure. */
  before: string;
  after: string;
}

export function judgeHtml({ before, after }: { before: string; after: string }): Judgement {
  const NBSP = ' ';
  const BOOL = new Set(['allowfullscreen']);
  const canonStyle = (s: string) =>
    s
      .split(';')
      .map((d) => d.trim())
      .filter(Boolean)
      .map((d) => {
        const i = d.indexOf(':');
        return `${d.slice(0, i).trim().toLowerCase()}: ${d
          .slice(i + 1)
          .trim()
          .replace(/\s+/g, ' ')}`;
      })
      .sort()
      .join('; ');
  const canonical = (html: string) => {
    const root = document.createElement('div');
    root.innerHTML = html;
    const out: string[] = [];
    const walk = (node: Node, depth: number) => {
      for (const n of node.childNodes) {
        if (n.nodeType === 3) {
          const t = (n.textContent ?? '').replace(/[ \t\r\n]+/g, ' ');
          if (t === ' ' && /\n/.test(n.textContent ?? '')) continue; // formatting whitespace
          if (t.trim() === '' && t !== ' ' && !t.includes(NBSP)) continue;
          out.push('  '.repeat(depth) + JSON.stringify(t.split(NBSP).join('&nbsp;')));
        } else if (n.nodeType === 1) {
          const el = n as Element;
          const attrs = [...el.attributes]
            .map((a) => {
              let v = a.value;
              if (a.name === 'style') v = canonStyle(v);
              if (BOOL.has(a.name)) v = '';
              if (a.name === 'class') v = v.trim().split(/\s+/).sort().join(' ');
              return `${a.name}="${v}"`;
            })
            .sort();
          out.push(
            `${'  '.repeat(depth)}<${el.tagName.toLowerCase()}${attrs.length ? ` ${attrs.join(' ')}` : ''}>`,
          );
          walk(el, depth + 1);
        }
      }
    };
    walk(root, 0);
    return `${out.join('\n')}\n`;
  };

  const cb = canonical(before);
  const ca = canonical(after);
  if (cb === ca) return { verdict: 'identical', cats: [], before: cb, after: ca };

  const TAG_EQ: Record<string, string> = { b: 'strong', i: 'em', strike: 's' };
  const UNWRAP = new Set(['span', 'thead', 'tbody', 'font']);
  // Order/nesting of formatting marks is not structural; their counts are checked as facts.
  const INLINE_FMT = new Set(['strong', 'em', 'u', 's', 'b', 'i', 'strike']);
  const STYLE_EQ: Record<string, string> = {
    'font-weight:bold': 'tag:strong',
    'font-weight:700': 'tag:strong',
    'font-style:italic': 'tag:em',
    'text-decoration:underline': 'tag:u',
    'text-decoration:line-through': 'tag:s',
  };
  const normDecl = (p: string, v: string) =>
    `${p.trim().toLowerCase()}:${v
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/'/g, '"')
      .replace(/\b0px\b/g, '0')
      .replace(/\s*,\s*/g, ',')
      .replace(/;$/, '')
      .toLowerCase()}`;

  const skeleton = (root: Element) => {
    const out: string[] = [];
    const walk = (n: Node) => {
      for (const c of n.childNodes) {
        if (c.nodeType === 3) {
          if (/[^ \t\r\n]/.test(c.textContent ?? '') && out[out.length - 1] !== '#') out.push('#');
        } else if (c.nodeType === 1) {
          const t = (c as Element).tagName.toLowerCase();
          if (UNWRAP.has(t) || INLINE_FMT.has(t)) {
            walk(c);
            continue;
          }
          out.push(`${TAG_EQ[t] || t}(`);
          walk(c);
          out.push(')');
        }
      }
    };
    walk(root);
    return out;
  };

  const facts = (root: Element) => {
    const raw = new Map<string, number>();
    const longhand = new Map<string, number>();
    const add = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) || 0) + 1);
    for (const el of root.querySelectorAll<HTMLElement>('*')) {
      const t0 = el.tagName.toLowerCase();
      const t = TAG_EQ[t0] || t0;
      if (!UNWRAP.has(t) && t !== 'p') add(raw, `tag:${t}`);
      for (const a of el.attributes) {
        if (a.name === 'style') {
          for (const d of (a.value || '')
            .split(';')
            .map((s) => s.trim())
            .filter(Boolean)) {
            const i = d.indexOf(':');
            if (i < 0) continue;
            const k = normDecl(d.slice(0, i), d.slice(i + 1));
            add(raw, STYLE_EQ[k] || `css:${k}`);
          }
          for (let i = 0; i < el.style.length; i++) {
            const p = el.style.item(i);
            add(longhand, normDecl(p, el.style.getPropertyValue(p)));
          }
        } else if (
          a.name !== 'data-implicit' &&
          !(['class', 'id', 'title', 'alt'].includes(a.name) && !a.value.trim())
        ) {
          const value =
            a.name === 'allowfullscreen' || a.name === 'checked'
              ? ''
              : a.name === 'class'
                ? a.value.trim().split(/\s+/).sort().join(' ')
                : a.value.trim();
          add(raw, `attr:${t}@${a.name}=${value}`);
        }
      }
    }
    add(raw, `text:${(root.textContent ?? '').replace(/[\s ]+/g, '')}`);
    return { raw, longhand };
  };

  const a = document.createElement('div');
  a.innerHTML = before;
  const b = document.createElement('div');
  b.innerHTML = after;
  // <span X><span X>…</span></span> with identical, inheritance-only styling renders like one span.
  const INHERIT =
    /^(color|font-size|font-family|font-weight|font-style|line-height|letter-spacing|text-align|background-color)$/;
  const inheritOnly = (el: Element) =>
    (el.getAttribute('style') || '')
      .split(';')
      .map((d) => d.split(':')[0]?.trim() ?? '')
      .filter(Boolean)
      .every((p) => INHERIT.test(p));
  for (const inner of [...a.querySelectorAll('span > span')]) {
    const outer = inner.parentElement as Element;
    if (
      canonStyle(inner.getAttribute('style') || '') ===
        canonStyle(outer.getAttribute('style') || '') &&
      inner.getAttribute('class') === outer.getAttribute('class') &&
      inner.attributes.length === outer.attributes.length &&
      inheritOnly(inner)
    )
      inner.replaceWith(...inner.childNodes);
  }
  // Adjacent equal spans (inheritance-only styling) are one span.
  const same = (x: Node | null, y: Element) =>
    !!x &&
    x.nodeType === 1 &&
    (x as Element).tagName === 'SPAN' &&
    canonStyle((x as Element).getAttribute('style') || '') ===
      canonStyle(y.getAttribute('style') || '') &&
    (x as Element).getAttribute('class') === y.getAttribute('class') &&
    (x as Element).attributes.length === y.attributes.length &&
    inheritOnly(y);
  for (const sp of [...a.querySelectorAll('span')]) {
    const prev = sp.previousSibling;
    if (same(prev, sp)) {
      (prev as Element).append(...sp.childNodes);
      sp.remove();
    }
  }

  const cats = new Set<string>();
  const sa = skeleton(a);
  const sb = skeleton(b);
  if (sa.join('') !== sb.join('')) {
    let i = 0;
    while (i < sa.length && sa[i] === sb[i]) i++;
    const stack: string[] = [];
    for (let j = 0; j < i; j++) {
      const s = sa[j] as string;
      if (s.endsWith('(')) stack.push(s.slice(0, -1));
      else if (s === ')') stack.pop();
    }
    const here = (sa[i] || 'END').replace('(', '');
    const there = (sb[i] || 'END').replace('(', '');
    cats.add(`structure: ${stack[stack.length - 1] || 'root'} > ${here}  became  ${there}`);
  }
  const fa = facts(a);
  const fb = facts(b);
  const scratch = document.createElement('div');
  for (const [k, n] of fa.raw) {
    if ((fb.raw.get(k) || 0) >= n) continue;
    if (k.startsWith('css:')) {
      // Accept when every longhand of this declaration survives.
      const [p, ...v] = k.slice(4).split(':');
      scratch.setAttribute('style', `${p}:${v.join(':')}`);
      const longs: string[] = [];
      for (let i = 0; i < scratch.style.length; i++) {
        const q = scratch.style.item(i);
        longs.push(normDecl(q, scratch.style.getPropertyValue(q)));
      }
      if (
        longs.length &&
        longs.every((l) => (fb.longhand.get(l) || 0) >= (fa.longhand.get(l) || 0))
      )
        continue;
      // A declaration the browser cannot parse (a misspelt property) has no longhands: the browser
      // ignores it either way, so losing it changes nothing on screen — but it is still reported.
      cats.add(longs.length ? `css lost: ${p}` : `css lost (unparseable): ${p}`);
    } else if (k.startsWith('attr:')) cats.add(`attr lost: ${k.slice(5).split('=')[0]}`);
    else if (k.startsWith('tag:')) cats.add(`tag lost: ${k.slice(4)}`);
    else cats.add('text changed');
  }
  // Formatting the editor added (e.g. font-weight:500 parsed as bold, rendered 700).
  for (const t of ['strong', 'em', 'u', 's'])
    if ((fb.raw.get(`tag:${t}`) || 0) > (fa.raw.get(`tag:${t}`) || 0))
      cats.add(`formatting added: ${t}`);
  return { verdict: cats.size ? 'loss' : 'harmless', cats: [...cats], before: cb, after: ca };
}

export function judge(page: Page, before: string, after: string): Promise<Judgement> {
  return page.evaluate(judgeHtml, { before, after });
}

/** A unified-ish line diff of two canonical forms, for failure messages. */
export function canonicalDiff(j: Judgement): string {
  const a = j.before.split('\n');
  const b = j.after.split('\n');
  const out: string[] = [];
  let i = 0;
  let k = 0;
  while (i < a.length || k < b.length) {
    if (a[i] === b[k]) {
      i++;
      k++;
      continue;
    }
    const nextInB = b.indexOf(a[i] as string, k);
    const nextInA = a.indexOf(b[k] as string, i);
    if (nextInB !== -1 && (nextInA === -1 || nextInB - k <= nextInA - i)) {
      while (k < nextInB) out.push(`+ ${b[k++]}`);
    } else if (nextInA !== -1) {
      while (i < nextInA) out.push(`- ${a[i++]}`);
    } else {
      if (i < a.length) out.push(`- ${a[i++]}`);
      if (k < b.length) out.push(`+ ${b[k++]}`);
    }
  }
  return out.join('\n');
}
