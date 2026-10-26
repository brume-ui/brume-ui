import { useCallback, useEffect, useState } from 'react';

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
    apply(next);
    setSchemeState(next);
  }, []);

  return {
    scheme,
    resolved: scheme === 'system' ? (systemDark ? 'dark' : 'light') : scheme,
    setScheme,
  };
}
