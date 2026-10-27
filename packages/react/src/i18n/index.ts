import type { Locale } from '@brume-ui/brume-schema';
import { en } from './en';
import { zhCN } from './zh-CN';
import { zhTW } from './zh-TW';

export type { Locale };
export type MessageKey = keyof typeof zhTW;
export type Messages = Record<MessageKey, string>;
export type TranslateVars = Record<string, string | number>;
export type Translate = (key: MessageKey, vars?: TranslateVars) => string;

const dictionaries: Record<Locale, Messages> = { 'zh-TW': zhTW, en, 'zh-CN': zhCN };

export function createTranslator(locale: Locale, overrides?: Partial<Messages>): Translate {
  const base = dictionaries[locale] ?? dictionaries['zh-TW'];
  return (key, vars) => {
    const template = overrides?.[key] ?? base[key] ?? zhTW[key];
    if (!vars) return template;
    return template.replace(/\{(\w+)\}/g, (match, name: string) =>
      name in vars ? String(vars[name]) : match,
    );
  };
}
