import type { MenuItem } from '@herb09638/brume-schema';
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

/** Resolve a kebab-case lucide name ("layout-dashboard") to its component; unknown names fall back to Circle. */
export function resolveIcon(name: string | undefined): LucideIcon {
  if (!name) return Circle;
  const found = (icons as Record<string, LucideIcon | undefined>)[toPascalCase(name)];
  return found ?? Circle;
}

/** Click handler that routes plain left-clicks through the adapter but leaves modified clicks to the browser. */
export function interceptClick(go: () => void, after?: () => void) {
  return (event: MouseEvent<HTMLAnchorElement>) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    event.preventDefault();
    go();
    after?.();
  };
}

/** Stable React key for a menu or breadcrumb entry (titles can repeat, urls usually don't). */
export function menuKey(item: { title: string; url?: string }): string {
  return `${item.title}|${item.url ?? ''}`;
}
