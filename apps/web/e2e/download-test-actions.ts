import type { Locator, Page } from '@playwright/test';

/** Desktop keeps secondary actions in a menu; mobile retains its inline actions. */
export async function clickDownloadAction(page: Page, task: Locator, name: string) {
  const button = task.getByRole('button', { name, exact: true });
  if (await button.isVisible()) return button.click();
  await task.getByRole('button', { name: /^文件操作：/ }).click();
  await page.getByRole('menuitem', { name, exact: true }).click();
}
