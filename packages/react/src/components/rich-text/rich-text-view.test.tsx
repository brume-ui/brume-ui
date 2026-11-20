import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createMemoryAdapter } from '../../memory-adapter';
import { BrumeProvider } from '../../provider';
import { RichTextView } from './rich-text-view';

function view(ui: React.ReactNode) {
  return render(<BrumeProvider adapter={createMemoryAdapter()}>{ui}</BrumeProvider>);
}

describe('RichTextView', () => {
  it('renders the html in a sandboxed iframe that can never run scripts', () => {
    view(<RichTextView label="商品說明" html="<p>你好<b>世界</b></p>" />);
    const frame = screen.getByTitle('商品說明') as HTMLIFrameElement;
    expect(frame.tagName).toBe('IFRAME');
    const sandbox = frame.getAttribute('sandbox');
    expect(sandbox).not.toBeNull();
    expect(sandbox).not.toContain('allow-scripts');
    expect(sandbox).not.toContain('allow-top-navigation');
    expect(sandbox).not.toContain('allow-forms');
    expect(frame.getAttribute('srcdoc')).toContain('<p>你好<b>世界</b></p>');
  });

  it('links safe contentCss urls as stylesheets and drops unsafe ones', () => {
    view(
      <RichTextView
        label="說明"
        html="<p>x</p>"
        contentCss={['/css/site.css', 'javascript:alert(1)', 'https://cdn.test/a.css?x=1&y="2"']}
      />,
    );
    const doc = screen.getByTitle('說明').getAttribute('srcdoc') ?? '';
    expect(doc).toContain('<link rel="stylesheet" href="/css/site.css">');
    expect(doc).toContain('href="https://cdn.test/a.css?x=1&amp;y=&quot;2&quot;"');
    expect(doc).not.toContain('javascript:');
  });

  it('shows an em dash for an empty document instead of an iframe', () => {
    const { container, rerender } = view(<RichTextView label="說明" html={null} />);
    expect(container.querySelector('iframe')).toBeNull();
    expect(container.textContent).toContain('—');
    rerender(
      <BrumeProvider adapter={createMemoryAdapter()}>
        <RichTextView label="說明" html="<p>&nbsp;</p>" />
      </BrumeProvider>,
    );
    expect(container.querySelector('iframe')).toBeNull();
    expect(container.textContent).toContain('—');
  });
});
