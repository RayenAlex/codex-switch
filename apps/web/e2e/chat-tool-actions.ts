import type { Page } from '@playwright/test';

export async function openChatTool(page: Page, tool: 'Git' | '终端') {
  if ((page.viewportSize()?.width ?? 0) > 860) {
    await page.getByRole('button', { name: tool === 'Git' ? '打开 Git' : '打开远程终端', exact: true }).click();
    return;
  }
  await page.getByRole('button', { name: '打开工具', exact: true }).click();
  await page.getByRole('button', { name: tool, exact: true }).click();
}
