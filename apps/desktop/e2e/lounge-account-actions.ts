import type { Page } from '@playwright/test';

export async function openAccountSettings(page: Page) {
  await page.getByRole('button', { name: '我的账号', exact: true }).click();
  await page.getByRole('menuitem', { name: '设置', exact: true }).click();
}

export async function openDesktopAvatarSettings(page: Page) {
  await openAccountSettings(page);
  await page.getByRole('button', { name: '修改头像', exact: true }).click();
}
