import { expect, test, type Locator, type Page } from '@playwright/test';

async function setup(page: Page) {
  const calls: { operation: string; threadId?: string; name?: string; archived?: boolean }[] = [];
  const threads = [{ id: 'one', name: '原来的对话', archived: false },
    { id: 'two', name: '另一个对话', archived: false },
    { id: 'running', name: '正在回复的对话', archived: false }];
  let failNext = false;
  await page.route('**/thread-action', async route => {
    const input = route.request().postDataJSON() as typeof calls[number];
    calls.push(input);
    if (input.operation === 'list') return route.fulfill({ json: {
      data: threads.filter(thread => thread.archived === input.archived).map(thread => ({ ...thread,
        preview: '', updatedAt: 1, cwd: '/project', status: { type: thread.id === 'running' ? 'active' : 'idle' } })),
      nextCursor: null,
    } });
    if (failNext) { failNext = false; return route.fulfill({ status: 500, json: {} }); }
    const index = threads.findIndex(thread => thread.id === input.threadId);
    if (input.operation === 'rename') threads[index].name = input.name!;
    if (input.operation === 'archive') threads[index].archived = true;
    if (input.operation === 'unarchive') threads[index].archived = false;
    if (input.operation === 'delete') threads.splice(index, 1);
    return route.fulfill({ json: {} });
  });
  await page.goto('./e2e/thread-actions-harness.html');
  await expect(page.locator('.chat-thread')).toHaveCount(3);
  return { calls, fail: () => { failNext = true; } };
}

async function longPress(page: Page, row: Locator, touch: boolean) {
  const box = (await row.boundingBox())!;
  const x = box.x + box.width / 2; const y = box.y + box.height / 2;
  if (!touch) {
    await page.mouse.move(x, y); await page.mouse.down();
    await expect(page.getByRole('menu')).toBeVisible();
    await page.mouse.up(); return;
  }
  const session = await page.context().newCDPSession(page);
  try {
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    const menu = (page.viewportSize()?.width ?? 0) > 860 ? page.getByRole('menu')
      : page.getByText('操作 - 原来的对话', { exact: true });
    await expect(menu).toBeVisible();
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } finally { await session.detach(); }
}

async function openActions(page: Page, title: string, mobile: boolean) {
  if (mobile) await page.getByRole('button', { name: `管理对话：${title}`, exact: true }).click();
  else await page.getByRole('button', { name: title, exact: true }).click({ button: 'right' });
}

function action(page: Page, name: string, mobile: boolean) {
  const desktopLabels: Record<string, string> = { '重命名对话': '重命名', '删除对话': '删除', '恢复': '恢复对话' };
  return page.getByRole(mobile ? 'button' : 'menuitem', { name: mobile ? name : desktopLabels[name] ?? name, exact: true });
}

test('long press renames without selecting; archive, restore and confirmed deletion target the correct chat',
  async ({ page, isMobile }) => {
    const { calls } = await setup(page);
    await longPress(page, page.getByRole('button', { name: '原来的对话', exact: true }), isMobile);
    await expect(page.getByTestId('selected')).toHaveText('none');
    if (!isMobile) {
      await expect(page.locator('.chat-thread-more')).toHaveCount(0);
      await expect(page.getByRole('dialog')).toHaveCount(0);
      const menu = (await page.getByRole('menu').boundingBox())!;
      const row = (await page.getByRole('button', { name: '原来的对话', exact: true }).boundingBox())!;
      expect(Math.abs(menu.x - (row.x + row.width / 2))).toBeLessThan(20);
      expect(Math.abs(menu.y - (row.y + row.height / 2))).toBeLessThan(20);
    }
    await page.screenshot({ path: `../../.codex-tmp/thread-actions-${isMobile ? 'mobile' : 'desktop'}.png` });
    expect(await page.locator(isMobile ? '.chat-thread-actions' : '.ant-dropdown-menu')
      .evaluate(element => element.getBoundingClientRect().width))
      .toBeLessThanOrEqual(400);
    await action(page, '重命名对话', isMobile).click();
    await page.getByRole('textbox', { name: '对话名称' }).fill('   ');
    await expect(page.getByRole('button', { name: '保存', exact: true })).toBeDisabled();
    const renamedTitle = '这是一个很长的对话标题，用来确认操作面板只显示一行并在末尾省略';
    await page.getByRole('textbox', { name: '对话名称' }).fill(`  ${renamedTitle}  `);
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.getByRole('button', { name: renamedTitle, exact: true })).toBeVisible();
    await openActions(page, renamedTitle, isMobile);
    if (isMobile) {
      const heading = page.getByText(`操作 - ${renamedTitle}`, { exact: true });
      await expect(heading).toBeVisible();
      await expect(heading).toHaveCSS('text-overflow', 'ellipsis');
      await expect(heading).toHaveCSS('white-space', 'nowrap');
      expect(await heading.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true);
      const titleBox = (await heading.boundingBox())!;
      const closeBox = (await page.getByRole('button', { name: '关闭', exact: true }).boundingBox())!;
      expect(titleBox.x + titleBox.width).toBeLessThanOrEqual(closeBox.x);
    }
    await page.screenshot({ path: `../../.codex-tmp/thread-actions-long-${isMobile ? 'mobile' : 'desktop'}.png` });
    await action(page, '归档', isMobile).click();
    await expect(page.getByRole('button', { name: renamedTitle, exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: '最近聊天 ▾', exact: true }).click();
    await openActions(page, renamedTitle, isMobile);
    await action(page, '恢复', isMobile).click();
    await expect(page.getByRole('button', { name: renamedTitle, exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: '已归档 ▾', exact: true }).click();
    await openActions(page, renamedTitle, isMobile);
    await action(page, '删除对话', isMobile).click();
    await expect(page.getByText('删除这条对话？', { exact: true })).toBeVisible();
    await expect(page.getByText('这条对话及其所有子对话将一起移入回收站，可在电脑端“会话管理”中恢复。'))
      .toBeVisible();
    expect(await page.locator('.chat-thread-actions').evaluate(element => element.getBoundingClientRect().width))
      .toBeLessThanOrEqual(400);
    await page.screenshot({ path: `../../.codex-tmp/thread-delete-${isMobile ? 'mobile' : 'desktop'}.png` });
    expect(calls.filter(call => call.operation === 'delete')).toHaveLength(0);
    await page.getByRole('button', { name: '取消', exact: true }).click();
    await openActions(page, renamedTitle, isMobile);
    await action(page, '删除对话', isMobile).click();
    await page.getByRole('button', { name: '删除对话', exact: true }).click();
    await expect(page.getByRole('button', { name: renamedTitle, exact: true })).toHaveCount(0);
    expect(calls.filter(call => call.operation === 'delete')).toEqual([{ operation: 'delete', threadId: 'one' }]);
    await expect(page.getByRole('button', { name: '另一个对话', exact: true })).toBeVisible();
  });

test('short taps select; context menus support failures, retry and active reply guards', async ({ page, isMobile }) => {
  const { fail } = await setup(page);
  await page.getByRole('button', { name: '另一个对话', exact: true }).click();
  await expect(page.getByTestId('selected')).toHaveText('two');
  await page.getByRole('button', { name: '原来的对话', exact: true }).click({ button: 'right' });
  await action(page, '重命名对话', isMobile).click();
  await page.getByRole('textbox', { name: '对话名称' }).fill('重试名称'); fail();
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('操作未完成，请稍后重试。');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('button', { name: '重试名称', exact: true })).toBeVisible();
  await openActions(page, '正在回复的对话', isMobile);
  await expect(action(page, '归档', isMobile)).toBeDisabled();
  await expect(action(page, '删除对话', isMobile)).toBeDisabled();
  await expect(page.getByRole('alert')).toHaveText('请等待回复结束后再操作。');
});

test('moving the pointer cancels a long press without opening the menu', async ({ page }) => {
  await setup(page);
  const row = page.getByRole('button', { name: '原来的对话', exact: true });
  await row.dispatchEvent('pointerdown', { pointerType: 'touch', isPrimary: true, button: 0, clientX: 40, clientY: 220 });
  await row.dispatchEvent('pointermove', { pointerType: 'touch', isPrimary: true, clientX: 40, clientY: 250 });
  await page.waitForTimeout(600);
  await row.dispatchEvent('pointerup', { pointerType: 'touch', isPrimary: true });
  await expect(page.getByText('操作 - 原来的对话', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(page.getByTestId('selected')).toHaveText('none');
});

test('desktop menu supports keyboard dismissal, touch and viewport edges', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Desktop context menu');
  await setup(page);
  const row = page.getByRole('button', { name: '原来的对话', exact: true });
  await row.press('Shift+F10');
  await expect(page.getByRole('menu')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toBeHidden();
  await expect(page.getByTestId('selected')).toHaveText('none');
  await longPress(page, row, true);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByTestId('selected')).toHaveText('none');
  await page.getByTestId('selected').click();
  await expect(page.getByRole('menu')).toBeHidden();
  await page.setViewportSize({ width: 900, height: 360 });
  await row.scrollIntoViewIfNeeded();
  await row.click({ button: 'right', position: { x: 4, y: 30 } });
  const bounds = (await page.getByRole('menu').boundingBox())!;
  expect(bounds.y).toBeGreaterThanOrEqual(0);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(360);
  await page.screenshot({ path: '../../.codex-tmp/thread-context-menu-edge.png' });
});

test('desktop archive failures stay in the context menu and can be retried', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Desktop context menu');
  const { fail, calls } = await setup(page);
  await openActions(page, '原来的对话', false);
  fail();
  await action(page, '归档', false).click();
  await expect(page.getByRole('menu')).toBeVisible();
  await expect(page.getByRole('alert')).toHaveText('操作未完成，请稍后重试。');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await action(page, '归档', false).click();
  await expect(page.getByRole('button', { name: '原来的对话', exact: true })).toHaveCount(0);
  expect(calls.filter(call => call.operation === 'archive')).toHaveLength(2);
});
