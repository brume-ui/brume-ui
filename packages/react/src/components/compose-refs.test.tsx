import { render } from '@testing-library/react';
import { createRef, type Ref } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { composeRefs, useComposedRefs } from './compose-refs';

describe('composeRefs', () => {
  it('forwards the node to function refs, object refs and skips undefined', () => {
    const fn = vi.fn();
    const obj = createRef<HTMLDivElement>();
    const el = document.createElement('div');
    const cleanup = composeRefs<HTMLDivElement>(fn, obj, undefined)(el);
    expect(fn).toHaveBeenCalledWith(el);
    expect(obj.current).toBe(el);
    cleanup();
    expect(fn).toHaveBeenLastCalledWith(null);
    expect(obj.current).toBeNull();
  });

  it('runs a cleanup-returning ref cleanup instead of calling it with null', () => {
    const inner = vi.fn();
    const withCleanup = vi.fn(() => inner);
    composeRefs<HTMLDivElement>(withCleanup)(document.createElement('div'))();
    expect(inner).toHaveBeenCalledTimes(1);
    expect(withCleanup).toHaveBeenCalledTimes(1);
  });
});

function Box({ a, b }: { a: Ref<HTMLDivElement>; b?: Ref<HTMLDivElement> }) {
  return <div ref={useComposedRefs(a, b)} />;
}

describe('useComposedRefs', () => {
  it('attaches the node once across re-renders with stable refs', () => {
    const a = vi.fn();
    const b = createRef<HTMLDivElement>();
    const { rerender, container, unmount } = render(<Box a={a} b={b} />);
    rerender(<Box a={a} b={b} />);
    rerender(<Box a={a} b={b} />);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b.current).toBe(container.firstChild);
    unmount();
    expect(a).toHaveBeenLastCalledWith(null);
    expect(b.current).toBeNull();
  });

  it('re-attaches when a ref changes', () => {
    const a = vi.fn();
    const next = vi.fn();
    const { rerender } = render(<Box a={a} />);
    rerender(<Box a={next} />);
    expect(a).toHaveBeenLastCalledWith(null);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
