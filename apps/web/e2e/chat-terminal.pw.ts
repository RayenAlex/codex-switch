import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { connect, fixtureUrl, login, openChatList, operationCount, screenshot, state } from './chat-helpers';
import { openChatTool } from './chat-tool-actions';

test.beforeEach(({}, info) => test.skip(info.project.name !== 'mobile' && !info.title.startsWith('desktop'),
  'Phone terminal drawer'));

test('desktop and phone terminals keep their command and shell when the theme changes', async ({ page, request }, info) => {
  await request.post(`${fixtureUrl}/test/reset`);
  await page.emulateMedia({ colorScheme: 'light' });
  await page.addInitScript(() => localStorage.setItem('codex-switch.web.theme.v1', 'dark'));
  await login(page); await connect(page);
  await openChatTool(page, '终端');
  const input = page.locator('.xterm-helper-textarea');
  await input.fill('theme_probe');
  const command = page.locator('.xterm-rows').filter({ hasText: 'theme_probe' });
  await expect(command).toBeVisible();
  const opened = await operationCount(request, 'guiTerminalOpen');
  for (const theme of ['dark', 'light', 'dark']) {
    await page.evaluate(value => window.dispatchEvent(new StorageEvent('storage', {
      key: 'codex-switch.web.theme.v1', newValue: value,
    })), theme);
    await expect(page.locator('.xterm-viewport')).toHaveCSS('background-color',
      theme === 'dark' ? 'rgb(0, 0, 0)' : 'rgb(255, 255, 255)');
    await expect(command).toBeVisible();
    await screenshot(page, info, `terminal-theme-${theme}`);
  }
  expect(await operationCount(request, 'guiTerminalOpen')).toBe(opened);
  expect(await operationCount(request, 'guiTerminalClose')).toBe(0);
});

test('opens a 90 percent terminal drawer, preserves its shell and draft, and sends input over P2P and Relay',
  async ({ page, request }, info) => {
    await request.post(`${fixtureUrl}/test/reset`);
    await login(page); await connect(page);
    await expect(page.getByRole('status').filter({ hasText: 'P2P' })).toBeVisible({ timeout: 20_000 });
    await openChatList(page);
    await page.getByRole('button', { name: '移动端聊天体验', exact: true }).click();
    const draft = page.getByRole('textbox', { name: '聊天消息' });
    await draft.fill('保留聊天草稿');
    const toggle = page.locator('.chat-header').getByRole('button', { name: '打开工具' });
    await toggle.click();
    await page.getByRole('button', { name: '终端', exact: true }).click();
    const drawer = page.getByRole('dialog', { name: '远程终端', exact: true });
    await expect(drawer).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: '正在打开终端' })).toHaveCount(0);
    const bounds = (await drawer.boundingBox())!;
    expect(Math.abs(bounds.height - 844 * .9)).toBeLessThan(2);
    expect(bounds.width).toBe(390);
    await expect.poll(async () => (await state(request)).operations.find(op => op.operation === 'guiTerminalOpen')?.cwd)
      .toBe('F:/projects/demo');
    const terminal = page.locator('.xterm-helper-textarea');
    await terminal.fill('echo phone'); await terminal.press('Enter');
    const input = async () => (await state(request)).operations.filter(op => op.operation === 'guiTerminalWrite')
      .map(op => op.data).join('');
    await expect.poll(input).toContain('echo phone\r');
    await drawer.getByRole('button', { name: 'Ctrl+C', exact: true }).tap();
    await expect.poll(input).toContain('\x03');
    await screenshot(page, info, 'phone-terminal-p2p');
    // StrictMode probes mount cleanup in development; compare the settled session before and after hiding.
    const opened = await operationCount(request, 'guiTerminalOpen');
    const closed = await operationCount(request, 'guiTerminalClose');
    await drawer.getByRole('button', { name: '收起终端', exact: true }).click();
    await expect(drawer).toBeHidden(); await expect(draft).toHaveValue('保留聊天草稿');
    expect(await operationCount(request, 'guiTerminalClose')).toBe(closed);
    await request.post(`${fixtureUrl}/test/fallback`);
    await expect(page.getByRole('status').filter({ hasText: 'Relay' })).toBeVisible({ timeout: 20_000 });
    await toggle.click();
    await page.getByRole('button', { name: '终端', exact: true }).click();
    await expect(drawer).toBeVisible();
    expect(await operationCount(request, 'guiTerminalOpen')).toBe(opened);
    await terminal.fill('echo relay'); await terminal.press('Enter');
    await expect.poll(input).toContain('echo relay\r');
    await page.evaluate(() => {
      Object.defineProperty(window.visualViewport, 'height', { configurable: true, get: () => 500 });
      window.visualViewport?.dispatchEvent(new Event('resize'));
    });
    await expect.poll(async () => Math.round((await drawer.boundingBox())!.height)).toBe(450);
    await screenshot(page, info, 'phone-terminal-keyboard');
    await drawer.getByRole('button', { name: '关闭终端 1', exact: true }).click();
    await expect.poll(() => operationCount(request, 'guiTerminalClose')).toBe(closed + 1);
    await expect(drawer).toHaveCount(0);
  });

test('keeps terminal controls and the current command visible when a phone rotates', async ({ page, request }, info) => {
  await request.post(`${fixtureUrl}/test/reset`);
  await login(page); await connect(page);
  await page.locator('.chat-header').getByRole('button', { name: '打开工具' }).click();
  await page.getByRole('button', { name: '终端', exact: true }).click();
  const drawer = page.getByRole('dialog', { name: '远程终端', exact: true });
  const command = page.locator('.xterm-rows > div').filter({ hasText: 'landscape_probe' }).last();
  await page.locator('.xterm-helper-textarea').fill('landscape_probe');
  await expect(command).toBeVisible();
  const opened = await operationCount(request, 'guiTerminalOpen');
  for (const viewport of [{ width: 844, height: 390 }, { width: 915, height: 412 },
    { width: 915, height: 250 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await expect(drawer.getByRole('button', { name: '收起终端', exact: true })).toBeInViewport({ ratio: 1 });
    await expect(drawer.getByRole('button', { name: '新建终端', exact: true })).toBeInViewport({ ratio: 1 });
    const keys = drawer.getByRole('button', { name: 'Ctrl+C', exact: true });
    await expect(keys).toBeInViewport({ ratio: 1 });
    await expect(command).toBeInViewport({ ratio: 1 });
    await expect.poll(async () => (await command.boundingBox())!.y + (await command.boundingBox())!.height)
      .toBeLessThanOrEqual((await keys.boundingBox())!.y);
    if (viewport.width > viewport.height) {
      await expect.poll(async () => Math.round((await drawer.boundingBox())!.width)).toBe(viewport.width);
      await expect.poll(async () => Math.round((await drawer.boundingBox())!.height)).toBe(viewport.height);
    }
    await screenshot(page, info, `terminal-${viewport.width}x${viewport.height}`);
  }
  expect(await operationCount(request, 'guiTerminalOpen')).toBe(opened);
  expect(await operationCount(request, 'guiTerminalClose')).toBe(0);
});

test('switching computers detaches the hidden terminal without closing the PC shell', async ({ page, request }) => {
  await request.post(`${fixtureUrl}/test/reset`);
  const devices = ['工作电脑', '家中电脑'].map((name, index) => ({ name, deviceId: `terminal-computer-${index}`,
    platform: 'Windows', online: true, capabilities: [], localProxyRunning: false,
    lastSeenAt: new Date().toISOString() }));
  await page.route('**/devices', route => route.fulfill({ json: { devices } }));
  await page.routeWebSocket('**/device-switch', socket => {
    socket.onMessage(() => socket.send(JSON.stringify({ type: 'devices-snapshot', devices })));
  });
  await login(page); await connect(page);
  const toggle = page.locator('.chat-header').getByRole('button', { name: '打开工具' });
  await expect(toggle).toBeEnabled(); await toggle.tap();
  await page.getByRole('button', { name: '终端', exact: true }).click();
  const drawer = page.getByRole('dialog', { name: '远程终端', exact: true });
  await expect(drawer).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: '正在打开终端' })).toHaveCount(0);
  const opened = await operationCount(request, 'guiTerminalOpen');
  const closed = await operationCount(request, 'guiTerminalClose');
  await drawer.getByRole('button', { name: '收起终端', exact: true }).tap();
  await expect(drawer).toBeHidden();
  await page.getByRole('button', { name: '选择电脑', exact: true }).tap();
  await page.getByRole('button', { name: '家中电脑 在线', exact: true }).tap();
  await expect(page.getByRole('button', { name: '选择电脑', exact: true })).toContainText('家中电脑');
  await expect(drawer).toBeHidden();
  expect(await operationCount(request, 'guiTerminalClose')).toBe(closed);
  await expect(toggle).toBeEnabled(); await toggle.tap();
  await page.getByRole('button', { name: '终端', exact: true }).click();
  await expect(drawer).toBeVisible();
  await expect(drawer).toContainText('家中电脑');
  // Both device aliases in this fixture route to the same PC, so its retained shell is discovered again.
  expect(await operationCount(request, 'guiTerminalOpen')).toBe(opened);
});

test('restores the same shell and output after disconnecting and reloading the phone page', async ({ page, request }) => {
  await request.post(`${fixtureUrl}/test/reset`);
  await login(page); await connect(page);
  const toggle = () => page.locator('.chat-header').getByRole('button', { name: '打开工具' });
  await expect(toggle()).toBeEnabled(); await toggle().click();
  await page.getByRole('button', { name: '终端', exact: true }).click();
  const drawer = page.getByRole('dialog', { name: '远程终端', exact: true });
  await expect(drawer).toBeVisible();
  await expect(page.locator('.xterm-rows')).toContainText('Remote shell ready');
  const input = page.locator('.xterm-helper-textarea');
  await input.fill('retained-marker'); await input.press('Enter');
  await expect(page.locator('.xterm-rows')).toContainText('retained-marker');
  const opened = await operationCount(request, 'guiTerminalOpen');
  const id = (await state(request)).operations.find(operation => operation.operation === 'guiTerminalWrite')!.id;
  await request.post(`${fixtureUrl}/test/disconnect`);
  await expect.poll(async () => (await state(request)).mobileConnections).toBeGreaterThan(1);
  await expect(page.locator('.xterm-rows')).toContainText('retained-marker');
  await page.reload(); await connect(page);
  await expect(toggle()).toBeEnabled(); await toggle().click();
  await page.getByRole('button', { name: '终端', exact: true }).click();
  await expect(page.locator('.xterm-rows')).toContainText('retained-marker');
  expect(await operationCount(request, 'guiTerminalOpen')).toBe(opened);
  expect(await operationCount(request, 'guiTerminalClose')).toBe(0);
  await input.fill('continued-marker'); await input.press('Enter');
  await expect.poll(async () => (await state(request)).operations.filter(operation =>
    operation.operation === 'guiTerminalWrite').at(-1)?.id).toBe(id);
  await expect(page.locator('.xterm-rows')).toContainText('continued-marker');
  await drawer.getByRole('button', { name: '关闭终端 1', exact: true }).click();
  await expect.poll(() => operationCount(request, 'guiTerminalClose')).toBe(1);
  await page.reload(); await connect(page);
  await expect(toggle()).toBeEnabled(); await toggle().click();
  await page.getByRole('button', { name: '终端', exact: true }).click();
  await expect.poll(() => operationCount(request, 'guiTerminalOpen')).toBe(opened + 1);
  await expect(page.locator('.xterm-rows')).not.toContainText('retained-marker');
});

test('bundled Android terminal renders output as text and forwards typing, shortcuts and resizing', async ({ page }) => {
  const html = readFileSync(new URL('../../native/assets/terminal.html', import.meta.url), 'utf8');
  await page.addInitScript(() => {
    const host = window as unknown as { messages: string[]; ReactNativeWebView: { postMessage: (data: string) => void } };
    host.messages = []; host.ReactNativeWebView = { postMessage: data => host.messages.push(data) };
  });
  await page.route('**/native-terminal.html', route => route.fulfill({ contentType: 'text/html', body: html }));
  await page.goto('native-terminal.html');
  const messages = () => page.evaluate(() => (window as unknown as { messages: string[] }).messages.map(raw =>
    JSON.parse(raw) as { type: string; data?: string }));
  await expect.poll(async () => (await messages()).some(value => value.type === 'ready')).toBe(true);
  await page.evaluate(() => {
    const host = window as unknown as { remoteTerminal: (event: object) => void };
    host.remoteTerminal({ type: 'output', data: [...new TextEncoder().encode('Android shell ready\r\n<script>bad</script>')] });
  });
  await expect(page.locator('.xterm-rows')).toContainText('<script>bad</script>');
  const input = page.locator('.xterm-helper-textarea');
  await input.fill('echo android'); await input.press('Enter');
  await page.getByRole('button', { name: 'Ctrl+C', exact: true }).tap();
  await expect.poll(async () => (await messages()).filter(value => value.type === 'input')
    .map(value => value.data).join('')).toContain('echo android\r\x03');
  await page.setViewportSize({ width: 390, height: 500 });
  await expect.poll(async () => (await messages()).filter(value => value.type === 'resize').length).toBeGreaterThan(0);
});

test('desktop browser docks a resizable terminal below the composer and restores its shell',
  async ({ page, request }, info) => {
  test.skip(info.project.name !== 'desktop', 'Desktop terminal panel');
  await request.post(`${fixtureUrl}/test/reset`);
  await login(page); await connect(page);
  await openChatTool(page, '终端');
  const panel = page.getByRole('region', { name: '终端', exact: true });
  await expect(panel).toBeVisible();
  await expect(page.locator('.xterm-rows')).toContainText('Remote shell ready');
  await expect(page.locator('aside[data-details-panel]:visible')).toHaveCount(0);
  const conversation = (await page.locator('.chat-conversation').boundingBox())!;
  const bounds = (await panel.boundingBox())!;
  expect(Math.round(bounds.width)).toBe(Math.round(conversation.width));
  expect(Math.round(bounds.y + bounds.height)).toBe(Math.round(conversation.y + conversation.height));
  expect(Math.round(bounds.height)).toBe(300);
  const draft = page.getByRole('textbox', { name: '聊天消息', exact: true });
  await draft.fill('终端打开时保留聊天草稿');
  const composer = (await draft.boundingBox())!;
  expect(composer.y + composer.height).toBeLessThanOrEqual(bounds.y);
  await panel.getByRole('separator', { name: '调整终端高度', exact: true }).press('ArrowUp');
  await expect.poll(async () => (await panel.boundingBox())!.height).toBeGreaterThan(bounds.height);
  const opened = await operationCount(request, 'guiTerminalOpen');
  await panel.getByRole('button', { name: '收起终端', exact: true }).click();
  await expect(panel).toBeHidden();
  await expect(draft).toHaveValue('终端打开时保留聊天草稿');
  await openChatTool(page, '终端');
  await expect(panel).toBeVisible();
  expect(await operationCount(request, 'guiTerminalOpen')).toBe(opened);
  await screenshot(page, info, 'bottom-terminal');
  await page.reload(); await connect(page);
  await expect(panel).toBeHidden();
  await openChatTool(page, '终端');
  await expect(page.locator('.xterm-rows')).toContainText('Remote shell ready');
  expect(await operationCount(request, 'guiTerminalOpen')).toBe(opened);
  expect(await operationCount(request, 'guiTerminalClose')).toBe(0);
  await screenshot(page, info, 'bottom-retained-terminal');
});

test('desktop and mobile terminals are isolated by project and restored after reload', async ({ page, request }, info) => {
  await request.post(`${fixtureUrl}/test/reset`);
  await login(page); await connect(page);
  const chooseRootProject = async () => {
    const desktop = info.project.name === 'desktop';
    await page.getByRole('button', { name: desktop ? '选择远程项目' : '选择项目', exact: true }).click();
    await page.getByRole('button', { name: desktop ? '选择其他文件夹…' : '新建项目', exact: true }).click();
    await page.getByRole('button', { name: '此电脑', exact: true }).click();
    await page.getByRole('button', { name: 'F:', exact: true }).click();
    await page.getByRole('button', { name: 'projects', exact: true }).click();
    await page.getByRole('button', { name: '选择此文件夹', exact: true }).click();
  };
  const drawer = info.project.name === 'desktop'
    ? page.getByRole('region', { name: '终端', exact: true })
    : page.getByRole('dialog', { name: '远程终端', exact: true });
  const rows = page.locator('.xterm-rows');
  const hide = () => drawer.getByRole('button', { name: '收起终端', exact: true }).click();
  const type = async (text: string) => {
    const input = page.locator('.xterm-helper-textarea');
    await input.fill(text); await input.press('Enter');
    await expect(rows).toContainText(text);
  };
  await chooseRootProject();
  await openChatTool(page, '终端');
  await type('parent-project-marker');
  await hide();
  await openChatList(page);
  await page.getByRole('button', { name: '移动端聊天体验', exact: true }).click();
  await openChatTool(page, '终端');
  await expect(rows).toContainText('Remote shell ready');
  await expect(rows).not.toContainText('parent-project-marker');
  await type('demo-project-marker');
  await hide();
  await openChatList(page);
  await page.getByRole('button', { name: /在 .* 中新建对话/ }).click();
  await openChatTool(page, '终端');
  await expect(rows).toContainText('demo-project-marker');
  expect(await operationCount(request, 'guiTerminalOpen')).toBe(2);
  await hide();
  await chooseRootProject();
  await openChatTool(page, '终端');
  await expect(rows).toContainText('parent-project-marker');
  await expect(rows).not.toContainText('demo-project-marker');
  expect(await operationCount(request, 'guiTerminalClose')).toBe(0);
  await drawer.getByRole('button', { name: '关闭终端 1', exact: true }).click();
  await expect(drawer).toHaveCount(0);
  await page.reload(); await connect(page);
  await openChatList(page);
  await page.getByRole('button', { name: '移动端聊天体验', exact: true }).click();
  await openChatTool(page, '终端');
  await expect(rows).toContainText('demo-project-marker');
  await expect(rows).not.toContainText('parent-project-marker');
  expect(await operationCount(request, 'guiTerminalOpen')).toBe(2);
  expect(await operationCount(request, 'guiTerminalClose')).toBe(1);
  await screenshot(page, info, 'project-terminal-restored');
});
