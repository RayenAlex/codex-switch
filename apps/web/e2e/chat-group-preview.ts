import { expect, type Page, type APIRequestContext, type TestInfo } from '@playwright/test';
import { openChatList, click, fixtureUrl, screenshot } from './chat-helpers';
import { isDesktop } from './chat-settings';

export async function groupPreviewJourney({ page, request, info }: {
  page: Page; request: APIRequestContext; info: TestInfo;
}) {
  await request.post(`${fixtureUrl}/test/sidebar`, { data: { action: 'group-preview' } });
  await openChatList(page);
  const drawer = page.locator('.chat-drawer, .chat-sidebar');
  const project = drawer.getByRole('region', { name: '演示项目', exact: true });
  const recent = drawer.getByRole('region', { name: '最近', exact: true });
  const five = drawer.getByRole('region', { name: '五条项目', exact: true });
  for (const group of [project, recent, five]) await expect(group.locator('.chat-thread')).toHaveCount(5);
  await expect(five.getByRole('button', { name: /展开显示/ })).toHaveCount(0);
  await click(project.getByRole('button', { name: '展开显示：演示项目' }));
  await expect(project.locator('.chat-thread')).toHaveCount(7);
  await expect(recent.locator('.chat-thread')).toHaveCount(5);
  await click(project.getByRole('button', { name: '收起：演示项目' }));
  await expect(project.locator('.chat-thread')).toHaveCount(5);
  await screenshot(page, info, '10-folded-project-groups');
  await click(project.getByRole('button', { name: '展开显示：演示项目' }));
  await click(project.getByRole('button', { name: '移动端聊天体验', exact: true }));
  if (!isDesktop(page)) await expect(drawer).toBeHidden();
  await openChatList(page);
  const visibleCount = page.viewportSize()!.width > 860 ? 7 : 5;
  await expect(project.locator('.chat-thread')).toHaveCount(visibleCount);
  await expect(project.getByRole('button', { name: '移动端聊天体验', exact: true })).toBeVisible();
  if (!isDesktop(page)) await click(drawer.getByRole('button', { name: '搜索聊天', exact: true }));
  const search = page.getByRole('textbox', { name: '搜索聊天' });
  await search.fill('聊天');
  const results = isDesktop(page) ? drawer.locator('.chat-thread-list') : page.locator('.chat-search-results');
  await expect(results.locator('.chat-thread')).toHaveCount(17);
  if (isDesktop(page)) await search.fill('');
  else await click(page.getByRole('button', { name: '关闭', exact: true }).last());
  await expect(project.locator('.chat-thread')).toHaveCount(visibleCount);
}
