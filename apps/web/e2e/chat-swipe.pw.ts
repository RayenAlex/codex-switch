import { expect, test, type Locator, type Page } from '@playwright/test';
import { connect, fixtureUrl, login, screenshot, send, settled } from './chat-helpers';

type Point = { x: number; y: number };
async function swipe(page: Page, points: Point[], cancel = false) {
  const session = await page.context().newCDPSession(page);
  try {
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [points[0]] });
    for (const point of points.slice(1)) {
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point] });
    }
    await session.send('Input.dispatchTouchEvent', { type: cancel ? 'touchCancel' : 'touchEnd', touchPoints: [] });
  } finally { await session.detach(); }
}

const drawer = (page: Page) => page.locator('.chat-drawer .ant-drawer-content');
const right = [{ x: 90, y: 300 }, { x: 115, y: 302 }, { x: 170, y: 306 }, { x: 240, y: 310 }];
const left = [{ x: 280, y: 300 }, { x: 250, y: 302 }, { x: 190, y: 306 }, { x: 100, y: 310 }];
const activeTab = (page: Page) => page.locator('.mobile-tabbar .adm-tab-bar-item-active');

async function trackSettling(page: Page, key: string) {
  return page.locator(`[data-primary-page="${key}"]`).evaluate(node => new Promise<number[]>(resolve => {
    const positions: number[] = [];
    const started = performance.now();
    const sample = () => {
      positions.push(node.getBoundingClientRect().x);
      if (performance.now() - started < 650) requestAnimationFrame(sample);
      else resolve(positions);
    };
    sample();
  }));
}

function trackDrawerSettling(panel: Locator) {
  return panel.evaluate(node => new Promise<number[]>(resolve => {
    const samples: number[] = [];
    const until = performance.now() + 500;
    const sample = () => {
      samples.push(node.getBoundingClientRect().x);
      if (performance.now() < until) requestAnimationFrame(sample);
      else resolve(samples);
    };
    sample();
  }));
}

test.beforeEach(async ({ page, request }) => {
  await request.post(`${fixtureUrl}/test/reset`);
  await login(page);
  await connect(page);
  await expect(page.getByRole('status').filter({ hasText: 'P2P' })).toBeVisible({ timeout: 16_000 });
});

test('swipes through adjacent main pages in both directions and retains the chat draft',
  async ({ page, isMobile }, info) => {
    test.skip(!isMobile, 'Main page swipes belong to the mobile layout.');
    await page.getByRole('textbox', { name: '聊天消息' }).fill('保留切页草稿');
    for (const label of ['账号', '发现', '设置', '设置']) {
      await swipe(page, left);
      await expect(activeTab(page)).toHaveText(label);
      await expect(drawer(page)).toHaveCount(0);
    }
    await screenshot(page, info, 'swipe-to-settings');
    for (const label of ['发现', '账号', '聊天']) {
      await swipe(page, right);
      await expect(activeTab(page)).toHaveText(label);
    }
    await expect(page.getByRole('textbox', { name: '聊天消息' })).toHaveValue('保留切页草稿');
    await swipe(page, right);
    await expect(drawer(page)).toBeVisible();
    await swipe(page, left);
    await expect(drawer(page)).toHaveCount(0);
    await expect(activeTab(page)).toHaveText('聊天');
  });

test('keeps short, cancelled, vertical-first and input gestures on the current page',
  async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Touch navigation belongs to the mobile layout.');
    await swipe(page, left.slice(0, 2));
    await expect(activeTab(page)).toHaveText('聊天');
    await swipe(page, left, true);
    await expect(activeTab(page)).toHaveText('聊天');
    await page.locator('.mobile-tabbar').getByText('账号', { exact: true }).click();
    await swipe(page, [{ x: 280, y: 300 }, { x: 280, y: 340 }, { x: 100, y: 360 }]);
    await expect(activeTab(page)).toHaveText('账号');
    await page.locator('.mobile-tabbar').getByText('聊天', { exact: true }).click();
    const input = page.getByRole('textbox', { name: '聊天消息' });
    await input.fill('正在编辑的草稿');
    const bounds = (await input.boundingBox())!;
    const y = bounds.y + bounds.height / 2;
    await swipe(page, [{ x: 250, y }, { x: 220, y }, { x: 150, y }]);
    await expect(activeTab(page)).toHaveText('聊天');
    await expect(input).toHaveValue('正在编辑的草稿');
  });

test('swiping discovery rows changes tabs without opening them and leaves subpages alone',
  async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Touch navigation belongs to the mobile layout.');
    await page.locator('.mobile-tabbar').getByText('发现', { exact: true }).click();
    const row = page.locator('.discovery-list').getByRole('button', { name: '设备', exact: true });
    const bounds = (await row.boundingBox())!;
    const y = bounds.y + bounds.height / 2;
    await swipe(page, [{ x: 280, y }, { x: 250, y }, { x: 190, y }, { x: 100, y }]);
    await expect(activeTab(page)).toHaveText('设置');
    await page.locator('.mobile-tabbar').getByText('发现', { exact: true }).click();
    await row.click();
    await expect(row).toHaveCount(0);
    await swipe(page, left);
    await swipe(page, right);
    await expect(activeTab(page)).toHaveText('发现');
    await expect(row).toHaveCount(0);
  });

test('desktop touch drags do not replace sidebar navigation', async ({ page, isMobile }) => {
  test.skip(isMobile, 'The desktop layout keeps its sidebar interaction.');
  const menu = page.locator('.desktop-sidebar nav');
  await menu.getByRole('button', { name: '账号', exact: true }).click();
  await swipe(page, [{ x: 800, y: 300 }, { x: 760, y: 300 }, { x: 660, y: 300 }]);
  await expect(menu.getByRole('button', { name: '账号', exact: true })).toHaveAttribute('aria-current', 'page');
});

test('shows both real pages under the finger before committing and keeps the tab bar still',
  async ({ page, isMobile }, info) => {
    test.skip(!isMobile, 'Page previews belong to the mobile layout.');
    const session = await page.context().newCDPSession(page);
    const tabs = await page.locator('.mobile-tabbar').boundingBox();
    try {
      for (const [from, to, label, targetLabel, direction] of [
        ['chat', 'accounts', '聊天', '账号', -1],
        ['accounts', 'discover', '账号', '发现', -1],
        ['discover', 'settings', '发现', '设置', -1],
        ['settings', 'discover', '设置', '发现', 1],
        ['discover', 'accounts', '发现', '账号', 1],
        ['accounts', 'chat', '账号', '聊天', 1],
      ] as const) {
        const start = direction < 0 ? 280 : 90;
        await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: start, y: 300 }] });
        await session.send('Input.dispatchTouchEvent', {
          type: 'touchMove', touchPoints: [{ x: start + direction * 100, y: 300 }],
        });
        const outgoing = page.locator(`[data-primary-page="${from}"]`);
        const incoming = page.locator(`[data-primary-page="${to}"]`);
        await expect(incoming).toHaveClass(/is-preview/);
        await expect(incoming).toHaveAttribute('inert', '');
        expect((await incoming.textContent())?.trim().length).toBeGreaterThan(0);
        const outgoingBox = (await outgoing.boundingBox())!;
        const incomingBox = (await incoming.boundingBox())!;
        expect(outgoingBox.x).toBeCloseTo(direction * 100, 0);
        expect(incomingBox.x - outgoingBox.x).toBeCloseTo(-direction * outgoingBox.width, 0);
        await expect(activeTab(page)).toHaveText(label);
        expect(await page.locator('.mobile-tabbar').boundingBox()).toEqual(tabs);
        await screenshot(page, info, `mid-swipe-${from}-${to}`);
        const settling = trackSettling(page, to);
        await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await expect(activeTab(page)).toHaveText(targetLabel);
        await expect(incoming).not.toHaveClass(/is-preview/);
        const positions = await settling;
        for (let index = 1; index < positions.length; index++) {
          expect(Math.abs(positions[index])).toBeLessThanOrEqual(Math.abs(positions[index - 1]) + 1);
        }
        expect(positions.at(-1)).toBeCloseTo(0, 0);
      }
    } finally { await session.detach(); }
  });

test('keeps the selected page onscreen when changing between phone and desktop widths', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Exercise both responsive layouts in one session.');
  await page.locator('.mobile-tabbar').getByText('设置', { exact: true }).click();
  const pane = page.locator('[data-primary-page="settings"]');
  for (const width of [1280, 390, 861, 860]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(pane).toBeInViewport();
    await expect.poll(async () => {
      const bounds = await pane.boundingBox();
      return bounds ? bounds.x >= 0 && bounds.x + bounds.width <= width + 1 : false;
    }).toBe(true);
  }
});

test('returns partial and cancelled previews to their original position without opening a row',
  async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Page previews belong to the mobile layout.');
    await page.locator('.mobile-tabbar').getByText('发现', { exact: true }).click();
    const pane = page.locator('[data-primary-page="discover"]');
    const original = await pane.boundingBox();
    for (const cancel of [false, true]) {
      await swipe(page, cancel ? left : left.slice(0, 2), cancel);
      await expect(page.locator('.primary-page-pane.is-preview')).toHaveCount(0);
      expect(await pane.boundingBox()).toEqual(original);
      await expect(activeTab(page)).toHaveText('发现');
      await expect(page.locator('.discovery-list')).toBeVisible();
    }
  });

test('swipes right across the conversation to open and left across a row or mask to close',
  async ({ page, isMobile }, info) => {
    test.skip(!isMobile, 'Touch gestures are exercised by the mobile browser project.');
    await page.getByRole('textbox', { name: '聊天消息' }).fill('保留草稿');
    await swipe(page, right);
    await expect(drawer(page)).toBeVisible();
    await screenshot(page, info, 'swipe-open-drawer');
    const row = page.getByRole('button', { name: '移动端聊天体验', exact: true });
    const bounds = await row.boundingBox();
    if (!bounds) throw new Error('Missing conversation row');
    const y = bounds.y + bounds.height / 2;
    await swipe(page, [{ x: 280, y }, { x: 250, y }, { x: 190, y }, { x: 100, y }]);
    await expect(drawer(page)).toHaveCount(0);
    await expect(page.getByRole('heading', { name: '新聊天', exact: true })).toBeVisible();
    await expect(page.getByRole('textbox', { name: '聊天消息' })).toHaveValue('保留草稿');
    await swipe(page, right);
    await expect(drawer(page)).toBeVisible();
    await swipe(page, [{ x: 380, y: 300 }, { x: 350, y: 300 }, { x: 290, y: 300 }]);
    await expect(drawer(page)).toHaveCount(0);
  });

test('drawer follows held drags and settles or cancels without jumping or changing tabs',
  async ({ page, isMobile }, info) => {
    test.skip(!isMobile, 'The drawer gesture belongs to the phone layout.');
    const session = await page.context().newCDPSession(page);
    const panel = page.locator('.chat-drawer .ant-drawer-content-wrapper');
    const touch = (type: string, x?: number) => session.send('Input.dispatchTouchEvent', {
      type, touchPoints: x === undefined ? [] : [{ x, y: 300 }],
    });
    const exposedWidth = async () => { const box = (await panel.boundingBox())!; return box.x + box.width; };
    const tabs = await page.locator('.mobile-tabbar').boundingBox();
    try {
      await touch('touchStart', 90);
      await touch('touchMove', 190);
      await expect.poll(exposedWidth).toBeCloseTo(100, 0);
      await expect(activeTab(page)).toHaveText('聊天');
      expect(await page.locator('.mobile-tabbar').boundingBox()).toEqual(tabs);
      await screenshot(page, info, 'drawer-held-open');
      await touch('touchMove', 230);
      await expect.poll(exposedWidth).toBeCloseTo(140, 0);
      const positions = trackDrawerSettling(panel);
      await touch('touchEnd');
      await expect.poll(async () => (await panel.boundingBox())?.x).toBeCloseTo(0, 0);
      const samples = await positions;
      for (let index = 1; index < samples.length; index++) {
        expect(samples[index]).toBeGreaterThanOrEqual(samples[index - 1] - 1);
      }
      await touch('touchStart', 250);
      await touch('touchMove', 150);
      await expect.poll(async () => (await panel.boundingBox())?.x).toBeCloseTo(-100, 0);
      await screenshot(page, info, 'drawer-held-close');
      await touch('touchCancel');
      await expect.poll(async () => (await panel.boundingBox())?.x).toBeCloseTo(0, 0);
      await swipe(page, left);
      await expect(drawer(page)).toHaveCount(0);
      await touch('touchStart', 90);
      await touch('touchMove', 190);
      await expect.poll(exposedWidth).toBeCloseTo(100, 0);
      await touch('touchCancel');
      await expect(drawer(page)).toHaveCount(0);
      await expect(activeTab(page)).toHaveText('聊天');
    } finally { await session.detach(); }
  });

test('settles the drawer with compositor transform and opacity animations', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'The desktop sidebar does not slide over the conversation.');
  const session = await page.context().newCDPSession(page);
  try {
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 90, y: 300 }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 190, y: 300 }] });
    // Observe animation creation, so even a slow test runner can inspect a completed transition.
    await page.locator('.chat-drawer').evaluate(root => {
      root.querySelectorAll<HTMLElement>('.ant-drawer-content-wrapper, .ant-drawer-mask').forEach(element => {
        const animate = element.animate.bind(element);
        element.animate = (...args) => {
          element.dataset.animatedProperties = JSON.stringify(args[0]);
          return animate(...args);
        };
      });
    });
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(page.locator('.chat-drawer .ant-drawer-content-wrapper'))
      .toHaveAttribute('data-animated-properties', /transform/);
    await expect(page.locator('.chat-drawer .ant-drawer-mask'))
      .toHaveAttribute('data-animated-properties', /opacity/);
    await expect.poll(async () => (await drawer(page).boundingBox())?.x).toBeCloseTo(0, 0);
  } finally { await session.detach(); }
});

test('ignores short, vertical-first, cancelled, selected-text and multitouch gestures',
  async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Touch gestures are exercised by the mobile browser project.');
    for (const path of [right.slice(0, 2),
      [{ x: 90, y: 300 }, { x: 92, y: 330 }, { x: 240, y: 340 }]]) {
      await swipe(page, path);
      await expect(page).toHaveURL(/\/web\//);
      await expect(drawer(page)).toHaveCount(0);
    }
    await swipe(page, right, true);
    await expect(drawer(page)).toHaveCount(0);
    await page.locator('.chat-empty p').evaluate(node => {
      const range = document.createRange(); range.selectNodeContents(node);
      const selection = window.getSelection(); selection?.removeAllRanges(); selection?.addRange(range);
    });
    await swipe(page, right);
    await expect(drawer(page)).toHaveCount(0);
    await page.evaluate(() => window.getSelection()?.removeAllRanges());
    const session = await page.context().newCDPSession(page);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart',
      touchPoints: [{ x: 90, y: 300, id: 0 }, { x: 120, y: 300, id: 1 }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove',
      touchPoints: [{ x: 220, y: 300, id: 0 }, { x: 250, y: 300, id: 1 }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await session.detach();
    await expect(drawer(page)).toHaveCount(0);
    await swipe(page, right);
    await expect(drawer(page)).toBeVisible();
  });

test('preserves message scrolling and horizontal table scrolling', async ({ page, request, isMobile }) => {
  test.skip(!isMobile, 'Touch scrolling is exercised by the mobile browser project.');
  await request.post(`${fixtureUrl}/test/sidebar`, { data: { action: 'web-parity' } });
  await page.getByRole('button', { name: '打开聊天列表' }).click();
  await page.getByRole('button', { name: '移动端聊天体验', exact: true }).click();
  await expect(drawer(page)).toHaveCount(0);
  const messages = page.locator('.chat-messages');
  await messages.evaluate(node => { node.scrollTop = node.scrollHeight; });
  const before = await messages.evaluate(node => node.scrollTop);
  await swipe(page, [{ x: 250, y: 250 }, { x: 250, y: 280 }, { x: 252, y: 350 }, { x: 252, y: 450 }]);
  await expect.poll(() => messages.evaluate(node => node.scrollTop)).toBeLessThan(before);
  await expect(drawer(page)).toHaveCount(0);
  const table = page.locator('.chat-messages table');
  await table.evaluate(node => {
    node.querySelectorAll<HTMLElement>('th,td').forEach(cell => { cell.style.minWidth = '400px'; });
    node.scrollLeft = 160;
  });
  await table.scrollIntoViewIfNeeded();
  const bounds = await table.boundingBox();
  if (!bounds) throw new Error('Missing horizontal table');
  const y = bounds.y + bounds.height / 2;
  await swipe(page, [{ x: 90, y }, { x: 120, y }, { x: 170, y }, { x: 240, y }]);
  await expect.poll(() => table.evaluate(node => node.scrollLeft)).toBeLessThan(160);
  await expect(drawer(page)).toHaveCount(0);
});

test('keeps desktop mouse selection and button navigation available', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Mouse behavior is exercised by the desktop browser project.');
  await page.mouse.move(400, 300); await page.mouse.down();
  await page.mouse.move(650, 310, { steps: 10 }); await page.mouse.up();
  await expect(drawer(page)).toHaveCount(0);
  await expect(page.locator('.chat-sidebar')).toBeVisible();
  await page.locator('.chat-header').getByRole('button', { name: '收起聊天列表' }).click();
  await expect(page.locator('.chat-sidebar')).toHaveCount(0);
  await page.getByRole('button', { name: '打开聊天列表' }).click();
  await expect(page.locator('.chat-sidebar')).toBeVisible();
  await expect(drawer(page)).toHaveCount(0);
});

test('keeps desktop chat beside independently collapsible menus and remembers the layout',
  async ({ page, isMobile }, info) => {
    test.skip(isMobile, 'Desktop uses persistent sidebars.');
    const sidebar = page.locator('.chat-sidebar');
    const header = page.locator('.chat-header');
    await expect(sidebar).toBeVisible();
    await expect(page.locator('.desktop-topbar')).toHaveCount(0);
    expect((await header.boundingBox())!.y).toBe(0);
    await sidebar.getByRole('button', { name: '移动端聊天体验', exact: true }).click();
    await expect(sidebar).toBeVisible();
    await send(page, 'slow sidebar layout test');
    await expect(page.getByRole('button', { name: '暂停生成' })).toBeVisible();
    await page.getByRole('textbox', { name: '聊天消息' }).fill('保留未发送草稿');
    await page.getByRole('button', { name: '收起主菜单' }).click();
    await expect(page.locator('.desktop-sidebar nav')).toBeVisible();
    await expect(page.locator('.desktop-sidebar .brand-mark')).toBeVisible();
    await expect(page.locator('.desktop-sidebar nav').getByRole('button')).toHaveCount(4);
    await expect(page.locator('.desktop-sidebar nav').getByRole('button', { name: '聊天', exact: true }))
      .toHaveAttribute('aria-current', 'page');
    await expect(page.locator('.desktop-sidebar').getByRole('button', { name: '展开主菜单' })).toBeVisible();
    await expect(sidebar).toBeVisible();
    await header.getByRole('button', { name: '收起聊天列表' }).click();
    await expect(sidebar).toHaveCount(0);
    const mainToggle = (await page.locator('.main-menu-toggle svg').boundingBox())!;
    const chatToggle = (await header.locator('.chat-back > svg').boundingBox())!;
    expect(mainToggle.y + mainToggle.height / 2).toBe(chatToggle.y + chatToggle.height / 2);
    await screenshot(page, info, 'desktop-collapsed-menus');
    const text = await page.locator('.chat-markdown').last().innerText();
    await expect.poll(() => page.locator('.chat-markdown').last().innerText()).not.toBe(text);
    await page.getByRole('button', { name: '打开聊天列表' }).click();
    await expect(sidebar).toBeVisible();
    await expect(page.getByRole('textbox', { name: '聊天消息' })).toHaveValue('保留未发送草稿');
    await page.getByRole('button', { name: '展开主菜单' }).click();
    await screenshot(page, info, 'desktop-three-columns');
    for (const width of [861, 1024, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(page.getByRole('button', { name: '发送消息', exact: true })).toBeInViewport();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await page.getByRole('textbox', { name: '聊天消息' }).fill('');
    await page.getByRole('button', { name: '暂停生成' }).click();
    await settled(page);
    await page.getByRole('button', { name: '收起主菜单' }).click();
    await header.getByRole('button', { name: '收起聊天列表' }).click();
    await page.reload();
    await expect(page.getByRole('button', { name: '展开主菜单' })).toBeVisible();
    await expect(page.getByRole('button', { name: '打开聊天列表' })).toBeVisible();
    await expect(sidebar).toHaveCount(0);
    await page.getByRole('button', { name: '打开聊天列表' }).click();
    await expect(sidebar).toBeVisible();
    const menu = page.locator('.desktop-sidebar nav');
    await menu.getByRole('button', { name: '设置', exact: true }).hover();
    await expect(page.getByRole('tooltip', { name: '设置', exact: true })).toBeVisible();
    await menu.getByRole('button', { name: '设置', exact: true }).click();
    await expect(menu.getByRole('button', { name: '设置', exact: true })).toHaveAttribute('aria-current', 'page');
    await menu.getByRole('button', { name: '聊天', exact: true }).click();
    await expect(sidebar).toBeVisible();
    await expect(page.getByRole('button', { name: '展开主菜单' })).toBeVisible();
  });
