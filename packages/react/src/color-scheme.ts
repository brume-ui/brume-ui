import { useCallback, useEffect, useState } from 'react';
import { prefersReducedMotion } from './motion/reduced-motion';

export type ColorScheme = 'light' | 'dark' | 'system';
export const COLOR_SCHEME_STORAGE_KEY = 'brume.color-scheme';

function isScheme(v: unknown): v is ColorScheme {
  return v === 'light' || v === 'dark' || v === 'system';
}

function readStored(): ColorScheme {
  try {
    const v = localStorage.getItem(COLOR_SCHEME_STORAGE_KEY);
    return isScheme(v) ? v : 'system';
  } catch {
    return 'system';
  }
}

function systemPrefersDark(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
}

function apply(scheme: ColorScheme): void {
  if (typeof document === 'undefined') return;
  if (scheme === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = scheme;
}

type ViewTransitionDocument = Document & {
  startViewTransition?(update: () => void): { finished?: Promise<unknown> } | undefined;
};

/** Set on <html> while Brume's own theme cross-fade runs; styles.css scopes its timing to it. */
export const THEME_SWITCH_ATTR = 'data-brume-theme-switch';

/**
 * Runs `update` inside a View Transition when the browser supports it, so the whole page
 * cross-fades between themes (styles.css sets the timing). Without support, under reduced motion
 * or in a hidden tab the switch is immediate, which is also flash-free.
 */
export function withThemeTransition(update: () => void): void {
  const doc = typeof document === 'undefined' ? null : (document as ViewTransitionDocument);
  if (
    !doc ||
    typeof doc.startViewTransition !== 'function' ||
    doc.visibilityState === 'hidden' ||
    prefersReducedMotion()
  ) {
    update();
    return;
  }
  const root = doc.documentElement;
  root.setAttribute(THEME_SWITCH_ATTR, '');
  const done = () => root.removeAttribute(THEME_SWITCH_ATTR);
  const transition = doc.startViewTransition(update);
  if (transition?.finished) transition.finished.then(done, done);
  else done();
}

export function useColorScheme(): {
  scheme: ColorScheme;
  resolved: 'light' | 'dark';
  setScheme(s: ColorScheme): void;
} {
  const [scheme, setSchemeState] = useState<ColorScheme>(readStored);
  const [systemDark, setSystemDark] = useState(systemPrefersDark);

  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setSystemDark(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const setScheme = useCallback((next: ColorScheme) => {
    try {
      localStorage.setItem(COLOR_SCHEME_STORAGE_KEY, next);
    } catch {
      // storage unavailable (private mode, blocked): still apply for this session
    }
    withThemeTransition(() => apply(next));
    setSchemeState(next);
  }, []);

  return {
    scheme,
    resolved: scheme === 'system' ? (systemDark ? 'dark' : 'light') : scheme,
    setScheme,
  };
}
