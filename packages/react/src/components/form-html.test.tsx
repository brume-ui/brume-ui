import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FormHtml } from './form-html';

describe('FormHtml', () => {
  it('renders sanitized content', () => {
    const { container } = render(
      <FormHtml html={'<p>Hi <b>there</b></p><img src=x onerror=alert(1)><script>1</script>'} />,
    );
    expect(container.querySelector('b')?.textContent).toBe('there');
    expect(container.querySelector('img, script')).toBeNull();
  });

  it('without a label spans the form width with no caption', () => {
    const { container } = render(<FormHtml html="<p>x</p>" />);
    expect(container.querySelector('[data-html-layout]')?.getAttribute('data-html-layout')).toBe(
      'block',
    );
    expect(container.querySelector('span.br\\:font-medium')).toBeNull();
  });

  it('with a label shows a label column next to the content', () => {
    const { container } = render(<FormHtml label="說明" html="<p>內容</p>" />);
    expect(screen.getByText('說明')).toBeTruthy();
    expect(screen.getByText('內容')).toBeTruthy();
    expect(container.querySelector('[data-html-layout]')?.getAttribute('data-html-layout')).toBe(
      'stacked',
    );
  });

  it('renders links with the link look and list styling hooks', () => {
    const { container } = render(<FormHtml html={'<a href="/orders">go</a><ul><li>a</li></ul>'} />);
    expect(container.querySelector('a')?.className).toContain('br:underline');
    expect(container.querySelector('ul')).not.toBeNull();
  });
});
