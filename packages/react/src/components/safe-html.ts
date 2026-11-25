import { createElement, Fragment, type ReactNode } from 'react';

/**
 * Turns a developer-written HTML snippet into React elements without ever touching the DOM live.
 *
 * The snippet is parsed by `DOMParser` into an inert document (no script runs, no resource loads),
 * then rebuilt: every element comes from the fixed `TAGS` lookup (the parsed node's own tag string
 * is only used as a key into it, never passed through), text nodes become strings, and the only
 * attributes that can exist are the ones built below. Total: it never throws and never recurses
 * past `MAX_DEPTH`.
 */

const MAX_DEPTH = 20;
const MAX_NODES = 2000;

const HTML_NS = 'http://www.w3.org/1999/xhtml';

const LINK_CLASS =
  'br:text-text br:underline br:decoration-border-strong br:underline-offset-2 br:transition-colors br:duration-fast br:hover:decoration-text br:rounded-[4px]';

/** Fixed lookup: parsed local name -> the tag string and classes used to build the element. */
const TAGS = new Map<string, { tag: string; className?: string }>([
  ['p', { tag: 'p' }],
  ['br', { tag: 'br' }],
  ['strong', { tag: 'strong' }],
  ['b', { tag: 'b' }],
  ['em', { tag: 'em' }],
  ['i', { tag: 'i' }],
  ['u', { tag: 'u' }],
  ['s', { tag: 's' }],
  ['code', { tag: 'code' }],
  ['small', { tag: 'small' }],
  ['span', { tag: 'span' }],
  ['a', { tag: 'a', className: LINK_CLASS }],
  ['ul', { tag: 'ul' }],
  ['ol', { tag: 'ol' }],
  ['li', { tag: 'li' }],
]);

/** Removed together with everything inside them. */
const DROPPED = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'template',
  'noscript',
  'svg',
  'math',
  'title',
  'textarea',
  'select',
]);

/** Decides on the attribute's raw string, the way a browser would see it, not on a resolved URL. */
function safeHref(raw: string): string | undefined {
  let start = 0;
  // ASCII whitespace and control characters (U+0000-U+0020) are ignored before the scheme.
  while (start < raw.length && raw.charCodeAt(start) <= 0x20) start += 1;
  // TAB, LF and CR are removed everywhere, as the URL parser does.
  const value = raw.slice(start).replace(/[\t\n\r]/g, '');
  if (/^(?:https?|mailto|tel):/i.test(value)) return value;
  // A single leading slash only: `//host` and `/\host` are protocol-relative in a browser.
  if (value.startsWith('/') && !/^\/[/\\]/.test(value)) return value;
  return undefined;
}

function isDropped(el: Element): boolean {
  return el.namespaceURI !== HTML_NS || DROPPED.has(el.localName.toLowerCase());
}

/** Plain text of a subtree, skipping dropped elements. Iterative: depth cannot blow the stack. */
function plainText(root: Node): string {
  let out = '';
  const stack: Node[] = [root];
  while (stack.length > 0) {
    const node = stack.pop() as Node;
    if (node.nodeType === 3) {
      out += node.nodeValue ?? '';
    } else if (node.nodeType === 1) {
      if (isDropped(node as Element)) continue;
      const kids = node.childNodes;
      for (let i = kids.length - 1; i >= 0; i--) stack.push(kids[i] as Node);
    }
  }
  return out;
}

interface Budget {
  nodes: number;
}

function convertChildren(parent: Node, depth: number, budget: Budget): ReactNode[] {
  const out: ReactNode[] = [];
  for (const child of Array.from(parent.childNodes)) {
    const converted = convertNode(child, depth, budget);
    if (converted === null || converted === '') continue;
    if (Array.isArray(converted)) out.push(...converted);
    else out.push(converted);
  }
  return out;
}

function convertNode(node: Node, depth: number, budget: Budget): ReactNode | ReactNode[] {
  if (node.nodeType === 3) {
    budget.nodes += 1;
    return node.nodeValue ?? '';
  }
  if (node.nodeType !== 1) return null; // comments, processing instructions, anything else
  const el = node as Element;
  if (isDropped(el)) return null;

  budget.nodes += 1;
  if (budget.nodes > MAX_NODES || depth >= MAX_DEPTH) return plainText(el);

  const spec = TAGS.get(el.localName.toLowerCase());
  const children = convertChildren(el, depth + 1, budget);
  if (!spec) return children; // unknown element: unwrap

  const props: Record<string, string> = {};
  if (spec.className) props.className = spec.className;
  if (spec.tag === 'a') {
    const href = safeHref(el.getAttribute('href') ?? '');
    if (href !== undefined) props.href = href;
    if ((el.getAttribute('target') ?? '').trim().toLowerCase() === '_blank') {
      props.target = '_blank';
    }
    props.rel = 'noopener noreferrer';
  }
  return spec.tag === 'br'
    ? createElement(spec.tag, props)
    : createElement(spec.tag, props, ...children);
}

export function safeHtmlToReact(html: string): ReactNode {
  if (typeof DOMParser === 'undefined' || html === '') return null;
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return createElement(Fragment, null, ...convertChildren(doc.body, 0, { nodes: 0 }));
  } catch {
    return null;
  }
}
