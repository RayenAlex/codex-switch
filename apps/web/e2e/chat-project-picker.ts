import { expect, type Page, type APIRequestContext } from '@playwright/test';
import { connect, settled, state } from './chat-helpers';
import { LONG_PROJECT_NAME } from '../../desktop/e2e/demo-project-directories';

function projectControls(page: Page) {
  const desktop = (page.viewportSize()?.width ?? 0) > 860;
  const choices = desktop ? page.getByRole('menu', { name: '项目', exact: true })
    : page.locator('.chat-project-choices');
  return {
    desktop, choices,
    trigger: page.getByRole('button', { name: desktop ? '选择远程项目' : '选择项目', exact: true }),
    option: (name: string | RegExp) => choices.getByRole(desktop ? 'menuitemradio' : 'button', { name }),
    checked: desktop ? 'aria-checked' : 'aria-pressed',
  };
}

export async function projectPickerJourney({ page, request, relay }: {
  page: Page; request: APIRequestContext; relay: boolean;
}) {
  if (relay) await page.evaluate(() => {
    window.RTCPeerConnection = class {
      constructor() { throw new Error('Use relay for this test'); }
    } as unknown as typeof RTCPeerConnection;
  });
  if (relay && (page.viewportSize()?.width ?? 0) < 860) await page.setViewportSize({ width: 320, height: 740 });
  await connect(page);
  await expect(page.getByRole('status').filter({ hasText: relay ? 'Relay' : 'P2P' })).toBeVisible({ timeout: 16_000 });
  const controls = projectControls(page);
  const project = controls.trigger;
  const draft = page.getByRole('textbox', { name: '聊天消息' });
  await expect(project).toHaveText(controls.desktop ? '选择项目' : '未选择项目');
  await draft.fill('保留这条尚未发送的消息');
  await expect(page.locator('.chat-header').getByRole('button', { name: '选择项目' })).toHaveCount(0);
  const triggerBounds = await project.boundingBox();
  const composerBounds = await page.locator('.chat-composer').boundingBox();
  expect(triggerBounds!.y + triggerBounds!.height).toBeLessThanOrEqual(composerBounds!.y);
  await project.click();
  await controls.option(/演示项目/).click();
  await expect(project).toHaveText('演示项目');
  await expect(draft).toHaveValue('保留这条尚未发送的消息');
  expect((await state(request)).operations.some(entry => entry.operation === 'start')).toBe(false);
  await project.click();
  await expect(controls.option(/演示项目/)).toHaveAttribute(controls.checked, 'true');
  await page.getByRole('button', {
    name: controls.desktop ? '选择其他文件夹…' : '新建项目', exact: true,
  }).click();
  await chooseNewProjectFolder(page);
  await expect(project).toHaveText(LONG_PROJECT_NAME);
  await expect(draft).toHaveValue('保留这条尚未发送的消息');
  expect(await project.locator('span').evaluate((element) => element.scrollWidth > element.clientWidth
    && getComputedStyle(element).textOverflow === 'ellipsis')).toBe(true);
  await expect(page.locator('.adm-toast-mask')).toHaveCount(0);
  await page.screenshot({ path: `../../.codex-tmp/project-switch-${page.viewportSize()?.width}-${relay}.png`,
    animations: 'disabled' });
  await project.click();
  await expect(controls.option(LONG_PROJECT_NAME)).toBeVisible();
  await page.screenshot({ path: `../../.codex-tmp/project-choices-${page.viewportSize()?.width}-${relay}.png`,
    animations: 'disabled' });
  if (controls.desktop) await page.getByRole('textbox', { name: '搜索项目', exact: true }).press('Escape');
  else await page.getByRole('button', { name: /^(关闭|Close)$/ }).click();
  await expect(project).toHaveText(LONG_PROJECT_NAME);
  await page.getByRole('button', { name: '发送消息', exact: true }).click();
  await expect.poll(async () => (await state(request)).operations.find((entry) => entry.operation === 'start')?.cwd)
    .toBe(`F:/projects/${LONG_PROJECT_NAME}`);
  await switchExistingConversation(page, request);
}

async function chooseNewProjectFolder(page: Page) {
  const picker = page.locator('.chat-project-picker');
  await picker.getByRole('button', { name: '此电脑', exact: true }).click();
  await expect(picker.getByRole('button', { name: '选择此文件夹' })).toBeDisabled();
  await picker.getByRole('button', { name: 'F:', exact: true }).click();
  await picker.getByRole('button', { name: 'projects', exact: true }).click();
  await picker.getByRole('button', { name: '不可访问的文件夹' }).click();
  await expect(picker.getByRole('alert')).toBeVisible();
  await picker.getByRole('button', { name: '此电脑', exact: true }).click();
  await picker.getByRole('button', { name: 'F:', exact: true }).click();
  await picker.getByRole('button', { name: 'projects', exact: true }).click();
  await picker.getByRole('button', { name: LONG_PROJECT_NAME, exact: true }).click();
  if ((page.viewportSize()?.width ?? 0) <= 860) await preservePickerInBackground(page);
  await picker.getByRole('button', { name: '返回上一级' }).click();
  await picker.getByRole('button', { name: LONG_PROJECT_NAME, exact: true }).click();
  await picker.getByRole('button', { name: '选择此文件夹' }).click();
}

async function preservePickerInBackground(page: Page) {
  const picker = page.locator('.chat-project-picker');
  for (const visibility of ['hidden', 'visible']) {
    await page.evaluate(value => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value });
      document.dispatchEvent(new Event('visibilitychange'));
    }, visibility);
    await expect(picker).toBeVisible();
    await expect(picker).toContainText(LONG_PROJECT_NAME);
    await expect(picker.getByRole('button', { name: '选择此文件夹' })).toBeEnabled();
  }
}

async function switchExistingConversation(page: Page, request: APIRequestContext) {
  const controls = projectControls(page);
  const project = controls.trigger;
  const draft = page.getByRole('textbox', { name: '聊天消息' });
  await settled(page);
  const selected = (await state(request)).threads.find(thread => thread.cwd === `F:/projects/${LONG_PROJECT_NAME}`)!;
  await draft.fill('切换项目后继续这段对话');
  await project.click();
  await expect(controls.option(LONG_PROJECT_NAME)).toHaveAttribute(controls.checked, 'true');
  await controls.option(/演示项目/).click();
  await expect(project).toHaveText('演示项目');
  await expect(draft).toHaveValue('切换项目后继续这段对话');
  await expect.poll(async () => (await state(request)).operations
    .findLast(entry => entry.operation === 'guiProjectSelect'))
    .toMatchObject({ cwd: 'F:/projects/demo', threadId: selected.id });
}
