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
  'dialog',
  'confirm',
  'toast',
  'data-table',
  'pagination',
  'empty-state',
  'skeleton',
  'app-shell',
  'page-header',
  'card',
  'shell',
  'fonts',
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
