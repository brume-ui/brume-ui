import { test as base, expect, type Page } from '@playwright/test';

export type Scheme = 'light' | 'dark';
export const SCHEMES: Scheme[] = ['light', 'dark'];

/** Every playground page (`index` is `/#/`); mirrors src/routes.tsx. Page roots are `pg-<name>`. */
export const PAGES = [
  'index',
  'button',
  'icon-button',
  'text-input',
  'password-input',
  'field',
  'select',
  'checkbox',
  'inputs',
  'dialog',
  'confirm',
  'toast',
  'menus',
  'data-table',
  'pagination',
  'empty-state',
  'skeleton',
  'app-shell',
  'page-header',
  'card',
  'shell',
  'fonts',
  'motion',
  'charts',
  'dashboard',
] as const;
export type PageName = (typeof PAGES)[number];

/** /#/fonts loads a ~5MB TTF for the jf 粉圓 sample. */
export const SLOW_PAGES: ReadonlySet<PageName> = new Set(['fonts']);

/** Persist the scheme the same way the switcher bar does, before any page script runs. */
export async function storeScheme(page: Page, scheme: Scheme): Promise<void> {
  await page.addInitScript((s) => {
    localStorage.setItem('brume.color-scheme', s);
  }, scheme);
}

export async function openPage(page: Page, name: PageName, scheme: Scheme): Promise<void> {
  await storeScheme(page, scheme);
  await page.goto(name === 'index' ? '/#/' : `/#/${name}`);
  await expect(page.locator('html')).toHaveAttribute('data-theme', scheme);
  await expect(page.getByTestId(`pg-${name}`)).toBeVisible();
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await animationsIdle(page);
}

/**
 * Waits for every finite animation/transition (entrances, row fades, indicator slides) to finish,
 * so axe and screenshots see the settled page. Infinite ones (skeleton shimmer, spinners) are skipped.
 */
export async function animationsIdle(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const finite = () =>
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().endTime !== Number.POSITIVE_INFINITY);
    // Effects can start new animations (e.g. rows after a frame), so settle twice.
    for (let i = 0; i < 2; i++) {
      await Promise.all(finite().map((a) => a.finished.catch(() => undefined)));
      await new Promise((r) => requestAnimationFrame(() => r(undefined)));
    }
  });
}

/**
 * Fails any test whose page logs a console error or throws an uncaught exception.
 */
export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
      });
      page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
      await use(errors);
      expect(errors, 'page logged errors').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
