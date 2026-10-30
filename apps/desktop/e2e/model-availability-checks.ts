import { expect, type Page } from '@playwright/test';

interface AvailabilityCheck {
  restrict: () => Promise<void>;
  restore: () => Promise<void>;
  screenshot: string;
}

export async function checkModelAvailability(page: Page, options: AvailabilityCheck) {
  const input = page.getByRole('textbox', { name: '聊天消息', exact: true });
  const send = page.getByRole('button', { name: '发送消息', exact: true });
  const picker = page.getByRole('button', { name: /^模型与推理强度/ });
  await input.fill('保留原模型和强度');
  await expect(send).toBeEnabled({ timeout: 20_000 });
  await options.restrict();
  await expect(picker).toHaveAttribute('data-model-unavailable', 'true');
  await expect(send).toBeDisabled();
  await input.press('Enter');
  await expect.poll(async () => (await input.inputValue()).trim()).toBe('保留原模型和强度');
  const labels = picker.locator(':scope > span').filter({ hasNot: page.locator('svg') });
  await expect(labels.nth(0)).toHaveCSS('color', 'rgb(215, 121, 121)');
  await expect(labels.nth(1)).toHaveCSS('color', 'rgb(215, 121, 121)');
  await picker.hover();
  const tooltip = page.getByRole('tooltip').filter({ hasText: '当前账户不支持所选模型' });
  await expect(tooltip).toBeVisible();
  await expect(page.locator('.ant-tooltip').filter({ has: tooltip })).toHaveCSS('opacity', '1');
  expect((await tooltip.boundingBox())!.width).toBeLessThanOrEqual(400);
  await page.screenshot({ path: options.screenshot, animations: 'disabled' });
  await options.restore();
  await expect(picker).not.toHaveAttribute('data-model-unavailable', 'true');
  await expect(send).toBeEnabled();
}
