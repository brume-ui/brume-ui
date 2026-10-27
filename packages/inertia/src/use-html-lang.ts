import { useEffect } from 'react';

/** Keeps `<html lang>` in sync with the shared locale (the root view only sets it on first load). */
export function useHtmlLang(locale: string): void {
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
}
