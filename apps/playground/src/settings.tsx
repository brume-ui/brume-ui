import {
  createContext,
  type ReactNode,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';

export type MenuPosition = 'side' | 'top';

export const ACCENT_PRESETS = ['#0e7490', '#1e3a8a', '#b45309'] as const;

interface Settings {
  accent: string;
  setAccent(accent: string): void;
  menuPosition: MenuPosition;
  setMenuPosition(position: MenuPosition): void;
}

const SettingsContext = createContext<Settings | null>(null);

export function SettingsProvider({ route, children }: { route: string; children: ReactNode }) {
  const [accent, setAccent] = useState<string>(ACCENT_PRESETS[0]);
  const [menuPosition, setMenuPosition] = useState<MenuPosition>('side');

  // tokens.css reads --br-accent-custom on :root (light mode only, by design).
  // Re-applied on route change too: AppShell's cleanup restores its mount-time value when it
  // unmounts, and layout effects here run after child cleanups.
  // biome-ignore lint/correctness/useExhaustiveDependencies: route is a deliberate trigger
  useLayoutEffect(() => {
    document.documentElement.style.setProperty('--br-accent-custom', accent);
  }, [accent, route]);

  const value = useMemo(
    () => ({ accent, setAccent, menuPosition, setMenuPosition }),
    [accent, menuPosition],
  );
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): Settings {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside <SettingsProvider>.');
  return ctx;
}
