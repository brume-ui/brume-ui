import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TreeLabel } from './tree-label';

describe('TreeLabel', () => {
  it('renders a root label as is, without an elbow', () => {
    const { container } = render(<TreeLabel depth={0}>服飾</TreeLabel>);
    const root = container.firstElementChild as HTMLElement;
    expect(root.textContent).toBe('服飾');
    expect(root.querySelector('[aria-hidden]')).toBeNull();
  });

  it('indents a child by its depth and draws a hidden elbow outside the label', () => {
    const { container } = render(
      <TreeLabel depth={2}>
        <a href="/x">qq</a>
      </TreeLabel>,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.dataset.depth).toBe('2');
    expect(root.style.paddingInlineStart).toBe('1.25rem');
    const elbow = root.querySelector('[aria-hidden="true"]');
    expect(elbow).not.toBeNull();
    expect(elbow?.contains(root.querySelector('a'))).toBe(false);
    expect(root.querySelector('a')?.textContent).toBe('qq');
  });

  it('treats a negative depth as a root', () => {
    const { container } = render(<TreeLabel depth={-3}>家居</TreeLabel>);
    expect((container.firstElementChild as HTMLElement).dataset.depth).toBe('0');
  });
});
