// Paste cleanup. Runs only on pasted HTML (Jodit `processPaste`), never on the loaded document.
// Ported from the phase 3-2 spike (editor-compare/src/lib/pasteClean.ts), tightened:
//   - every element outside the allow-list is unwrapped (its text survives), never kept
//   - every attribute outside a per-tag allow-list is removed (class, id, style, on*, mso-*, ...)
//   - javascript:/vbscript:/data: URLs are dropped; data: images too, because images must go through upload
// Needs DOMParser (browser, or jsdom in tests).

const KEEP_ATTRS: Record<string, string[]> = {
  a: ['href', 'target', 'rel'],
  img: ['src', 'alt', 'width', 'height'],
  td: ['colspan', 'rowspan'],
  th: ['colspan', 'rowspan'],
  ol: ['start'],
};
const KEEP_TAGS = new Set([
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'p',
  'br',
  'ul',
  'ol',
  'li',
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'th',
  'td',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'sub',
  'sup',
  'blockquote',
  'hr',
  'a',
  'img',
]);
const DROP_WITH_CONTENT =
  'style,script,meta,link,title,xml,head,template,noscript,object,embed,iframe,svg,button,input,select,textarea,form,colgroup';
const BLOCKS = 'p,h1,h2,h3,h4,h5,h6,ul,ol,li,table,blockquote,div,hr,pre';
const TAG_MAP: Record<string, string> = { STRIKE: 's', DEL: 's' };
const NBSP = /[\s ]/g;
// browsers ignore tab/newline/control chars inside a scheme, so strip them before testing
// biome-ignore lint/suspicious/noControlCharactersInRegex: intentional, matching how URL parsers skip them
const URL_NOISE = /[\u0000-  ]+/g;

function badUrl(value: string): boolean {
  const v = value.replace(URL_NOISE, '');
  return /^(javascript|vbscript|data|file):/i.test(v);
}

export function cleanPastedHtml(html: string): string {
  const doc = new DOMParser().parseFromString(
    html.replace(/<!--\[if[\s\S]*?<!\[endif\]-->/gi, ''),
    'text/html',
  );
  const body = doc.body;

  // Word lists: <p class=MsoListParagraph style="mso-list:l0 level1 lfo1"><span style="mso-list:Ignore">1.</span>Text</p>
  const listParas = [...body.querySelectorAll<HTMLElement>('p,h1,h2,h3,h4,h5,h6')].filter((p) =>
    /mso-list:\s*l\d/i.test(p.getAttribute('style') || ''),
  );
  let currentList: HTMLElement | null = null;
  for (const p of listParas) {
    const marker = p.querySelector('[style*="mso-list:Ignore" i], [style*="mso-list: Ignore" i]');
    const ordered = marker ? /^\s*\(?[0-9a-zA-Z]{1,3}[.)]/.test(marker.textContent || '') : false;
    marker?.remove();
    if (
      !currentList ||
      p.previousElementSibling !== currentList ||
      (currentList.tagName === 'OL') !== ordered
    ) {
      currentList = doc.createElement(ordered ? 'ol' : 'ul');
      p.before(currentList);
    }
    const li = doc.createElement('li');
    li.append(...p.childNodes);
    currentList.append(li);
    p.remove();
  }

  body.querySelectorAll(DROP_WITH_CONTENT).forEach((el) => {
    el.remove();
  });
  const walker = doc.createTreeWalker(body, NodeFilter.SHOW_COMMENT);
  const comments: Node[] = [];
  while (walker.nextNode()) comments.push(walker.currentNode);
  for (const c of comments) c.parentNode?.removeChild(c);

  const all = [...body.querySelectorAll<HTMLElement>('*')].reverse(); // children first
  for (const el of all) {
    if (!el.isConnected) continue;
    const tag = el.tagName;
    const lower = tag.toLowerCase();

    // attributes first: nothing outside the allow-list survives, on any element
    const keep = KEEP_ATTRS[lower] || [];
    for (const a of [...el.attributes]) if (!keep.includes(a.name)) el.removeAttribute(a.name);

    if (TAG_MAP[tag]) {
      const n = doc.createElement(TAG_MAP[tag]);
      n.append(...el.childNodes);
      el.replaceWith(n);
      continue;
    }
    if (tag === 'DIV') {
      // web pages: div soup -> paragraph when it only holds inline content, else unwrap
      if (el.querySelector(BLOCKS)) el.replaceWith(...el.childNodes);
      else if (el.textContent?.trim() || el.querySelector('img')) {
        const p = doc.createElement('p');
        p.append(...el.childNodes);
        el.replaceWith(p);
      } else el.remove();
      continue;
    }
    if (!KEEP_TAGS.has(lower)) {
      // span, font, o:p, w:*, v:*, section, ... : keep the text, lose the element
      el.replaceWith(...el.childNodes);
      continue;
    }
    if (tag === 'A') {
      const href = el.getAttribute('href') || '';
      if (badUrl(href) || href.startsWith('#_')) el.removeAttribute('href'); // Word bookmarks too
      if (!el.getAttribute('href')) {
        el.replaceWith(...el.childNodes);
        continue;
      }
    }
    if (tag === 'IMG' && badUrl(el.getAttribute('src') || '')) {
      el.remove();
      continue;
    }
    // empty inline formatting
    if (
      /^(STRONG|B|EM|I|U|S|A|SUB|SUP)$/.test(tag) &&
      !el.textContent?.trim() &&
      !el.querySelector('img,br')
    ) {
      el.replaceWith(...el.childNodes);
    }
  }
  // empty paragraphs Word adds between everything
  for (const p of body.querySelectorAll('p')) {
    if (!p.textContent?.replace(NBSP, '') && !p.querySelector('img,br')) p.remove();
  }
  return body.innerHTML.replace(/\n{2,}/g, '\n').trim();
}
