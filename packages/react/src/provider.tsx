import { createContext, type ReactNode, useContext, useMemo } from 'react';
import type { BrumeAdapter } from './adapter';
import { createTranslator, type Locale, type MessageKey, type Messages } from './i18n';

interface BrumeContextValue {
  adapter: BrumeAdapter;
  locale: Locale;
  t(key: MessageKey, vars?: Record<string, string | number>): string;
}

const BrumeContext = createContext<BrumeContextValue | null>(null);

export function BrumeProvider(props: {
  adapter: BrumeAdapter;
  locale?: Locale;
  messages?: Partial<Messages>;
  children: ReactNode;
}) {
  const { adapter, locale = 'zh-TW', messages, children } = props;
  const value = useMemo<BrumeContextValue>(
    () => ({ adapter, locale, t: createTranslator(locale, messages) }),
    [adapter, locale, messages],
  );
  return <BrumeContext.Provider value={value}>{children}</BrumeContext.Provider>;
}

export function useBrume(): BrumeContextValue {
  const ctx = useContext(BrumeContext);
  if (!ctx) throw new Error('useBrume must be used inside <BrumeProvider>.');
  return ctx;
}
