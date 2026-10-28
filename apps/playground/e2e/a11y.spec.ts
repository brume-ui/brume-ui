import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { animationsIdle, expect, openPage, PAGES, SCHEMES, SLOW_PAGES, test } from './support';

/** `include` limits the scan to that part of the page. */
async function expectNoViolations(page: Page, include?: string): Promise<void> {
  const builder = new AxeBuilder({ page });
  if (include) builder.include(include);
  const { violations } = await builder.analyze();
  expect(
    violations.map((v) => ({
      id: v.id,
      help: v.help,
      nodes: v.nodes.map((n) => `${n.target.join(' ')} — ${n.failureSummary}`),
    })),
  ).toEqual([]);
}

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
] as const;

for (const viewport of VIEWPORTS) {
  test.describe(viewport.name, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    for (const scheme of SCHEMES) {
      for (const name of PAGES) {
        test(`${name} ${scheme} has no axe violations`, async ({ page }) => {
          if (SLOW_PAGES.has(name)) test.setTimeout(90_000);
          await openPage(page, name, scheme);
          await expectNoViolations(page);
        });
      }

      test(`shell with dialog open ${scheme} has no axe violations`, async ({ page }) => {
        await openPage(page, 'shell', scheme);
        await page.getByRole('button', { name: '新增使用者' }).click();
        await expect(page.getByRole('dialog', { name: '新增使用者' })).toBeVisible();
        await animationsIdle(page);
        await expectNoViolations(page);
      });

      test(`grid with every column and the filter panel open ${scheme} has no axe violations`, async ({
        page,
      }) => {
        // No stored choice hides nothing: every display and editor column is on screen.
        await page.addInitScript(() => localStorage.setItem('brume.grid.orders.hidden', '[]'));
        await openPage(page, 'grid', scheme);
        await page.getByRole('button', { name: '篩選', exact: true }).click();
        await expect(page.getByRole('button', { name: '套用篩選' })).toBeVisible();
        await animationsIdle(page);
        await expectNoViolations(page);
      });

      test(`grid with a row menu open ${scheme} has no axe violations`, async ({ page }) => {
        await openPage(page, 'grid', scheme);
        await page.getByRole('button', { name: 'ORD-2610048 的更多操作' }).click();
        await expect(page.getByRole('menu')).toBeVisible();
        await animationsIdle(page);
        // The open (modal) menu hides the page from assistive tech, which trips the page-level
        // landmark rules; what is on offer now is the menu.
        await expectNoViolations(page, '[role="menu"]');
      });

      test(`grid with the batch bar and an inline error ${scheme} has no axe violations`, async ({
        page,
      }) => {
        await openPage(page, 'grid', scheme);
        await page.getByRole('checkbox', { name: '選取 ORD-2610047' }).click();
        await page.getByRole('checkbox', { name: '選取 ORD-2610046' }).click();
        await expect(page.getByRole('region', { name: '批次操作' })).toBeVisible();
        const row = page.getByRole('row', { name: /ORD-2610048/ });
        await row.getByRole('button', { name: /^編輯客戶：/ }).click();
        await row.getByRole('textbox', { name: '客戶' }).fill('一二三四五六七八九十十一');
        await page.keyboard.press('Enter');
        await expect(row.getByRole('alert')).toBeVisible();
        await animationsIdle(page);
        await expectNoViolations(page);
      });
    }
  });
}
