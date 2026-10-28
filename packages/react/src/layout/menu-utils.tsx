import type { MenuItem } from '@brume-ui/brume-schema';
import * as lucide from 'lucide-react';
import { Circle, icons, type LucideIcon } from 'lucide-react';
import type { MouseEvent } from 'react';

/** Path part of a URL: no origin, query, hash or trailing slash (except root). */
export function pathOf(url: string): string {
  let path: string;
  try {
    path = new URL(url, 'http://brume.local').pathname;
  } catch {
    path = url.split(/[?#]/)[0] ?? url;
  }
  return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
}

export function flattenMenu(items: MenuItem[]): MenuItem[] {
  return items.flatMap((item) => [item, ...flattenMenu(item.children ?? [])]);
}

/**
 * The menu item that represents the current page: exact path match first, otherwise the item whose
 * url is the longest path-prefix (on a "/" boundary) of the current path. The home url (default "/") only
 * matches exactly.
 */
export function findCurrentItem(
  items: MenuItem[],
  currentUrl: string,
  homeUrl = '/',
): MenuItem | null {
  const current = pathOf(currentUrl);
  const home = pathOf(homeUrl);
  let best: MenuItem | null = null;
  let bestLen = -1;
  for (const item of flattenMenu(items)) {
    if (!item.url) continue;
    const path = pathOf(item.url);
    const matches = path === current || (path !== home && current.startsWith(`${path}/`));
    if (matches && path.length > bestLen) {
      best = item;
      bestLen = path.length;
    }
  }
  return best;
}

export function containsItem(item: MenuItem, target: MenuItem | null): boolean {
  if (!target) return false;
  return (item.children ?? []).some((child) => child === target || containsItem(child, target));
}

function toPascalCase(name: string): string {
  return name
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

declare const process: { env: { NODE_ENV?: string } };

/** True outside production builds (bundlers replace `process.env.NODE_ENV`). */
function isDev(): boolean {
  try {
    return process.env.NODE_ENV !== 'production';
  } catch {
    return false;
  }
}

const iconComponents = new Set<unknown>(Object.values(icons));
const warned = new Set<string>();

/**
 * Resolve a kebab-case lucide name ("layout-dashboard") to its component. Names lucide renamed
 * but still exports as aliases ("trash-2", "home") resolve too. Unknown names fall back to Circle,
 * with a console warning in development.
 */
export function resolveIcon(name: string | undefined): LucideIcon {
  if (!name) return Circle;
  const pascal = toPascalCase(name);
  const found = (icons as Record<string, LucideIcon | undefined>)[pascal];
  if (found) return found;
  const alias = (lucide as Record<string, unknown>)[pascal];
  if (iconComponents.has(alias)) return alias as LucideIcon;
  if (isDev() && !warned.has(name)) {
    warned.add(name);
    console.warn(`[brume] Unknown lucide icon "${name}"; showing a circle instead.`);
  }
  return Circle;
}

/**
 * Whether a click on a link is a plain left click the app may handle itself. Modified clicks
 * (new tab, new window, download) and clicks something already handled belong to the browser.
 */
export function isPlainClick(event: MouseEvent): boolean {
  return (
    !event.defaultPrevented &&
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

/** Click handler that routes plain left-clicks through the adapter but leaves modified clicks to the browser. */
export function interceptClick(go: () => void, after?: () => void) {
  return (event: MouseEvent<HTMLAnchorElement>) => {
    if (!isPlainClick(event)) return;
    event.preventDefault();
    go();
    after?.();
  };
}

/** Stable React key for a menu or breadcrumb entry (titles can repeat, urls usually don't). */
export function menuKey(item: { title: string; url?: string }): string {
  return `${item.title}|${item.url ?? ''}`;
}
