import { test, expect } from '@playwright/test';
import { modelSettingsBackend } from './model-settings-backend';

test('local settings persist and change active-turn sends without changing pending messages', async ({ page }, info) => {
  test.setTimeout(90_000);
  const backend = modelSettingsBackend();
  await backend.attach(page.context());
  await page.setViewportSize({ width: 1280, height: 900 });
  try {
    await page.goto('/e2e/model-settings-harness.html');
    await page.getByRole('button', { name: '对话 a' }).click();
    await expect(page.getByRole('status', { name: '模型同步' })).toHaveText('模型设置已同步');
    backend.startTurn('a');
    await expect(page.getByRole('button', { name: '停止生成', exact: true })).toBeVisible();
    await page.getByRole('textbox', { name: '聊天消息' }).fill('保留的待发送消息');
    await page.getByRole('button', { name: '加入待发送', exact: true }).click();
    await expect.poll(() => backend.queue().threads.a?.map(message => message.text))
      .toEqual(['保留的待发送消息']);
    await page.getByRole('button', { name: 'GUI 设置', exact: true }).click();
    await page.getByRole('tab', { name: '消息发送', exact: true }).click();
    const toggle = page.getByRole('switch', { name: '待发送', exact: true });
    await expect(toggle).toBeChecked();
    await toggle.uncheck();
    await page.screenshot({ path: info.outputPath('local-message-settings.png'), animations: 'disabled' });
    await page.getByRole('button', { name: /^完\s*成$/ }).click();
    await page.getByRole('textbox', { name: '聊天消息' }).fill('立即发送的消息');
    await page.getByRole('button', { name: '发送消息', exact: true }).click();
    await expect.poll(() => backend.sends).toEqual([expect.objectContaining({
      operation: 'steer', threadId: 'a', turnId: 'live', text: '立即发送的消息',
    })]);
    expect(backend.queue().threads.a.map(message => message.text)).toEqual(['保留的待发送消息']);
    await page.reload();
    await page.getByRole('button', { name: 'GUI 设置', exact: true }).click();
    await page.getByRole('tab', { name: '消息发送', exact: true }).click();
    await expect(toggle).not.toBeChecked();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(toggle).toBeInViewport();
    await page.screenshot({ path: info.outputPath('local-message-settings-narrow.png'), animations: 'disabled' });
  } finally { backend.releaseUsage(); }
});
