import { expect, it, vi } from 'vitest';
import { ThreadListCache } from '../../../../shared/remote-chat/client/threadListCache';
import { readThreadListPage } from '../../../../shared/remote-chat/client/threadListPages';
import type { Thread } from '../../../../shared/remote-chat/client/types';

const thread = (id: string): Thread => ({ id, preview: '', cwd: '/project', updatedAt: 1 });
const query = { archived: false };

it('fills missing pages once and shares them with local and other remote readers', async () => {
  const fetch = vi.fn().mockResolvedValueOnce({ data: [thread('one')], nextCursor: 'backend-next' })
    .mockResolvedValueOnce({ data: [thread('two'), thread('three')], nextCursor: null });
  const cache = new ThreadListCache(fetch);
  const first = await readThreadListPage(cache, query, { pageSize: 2 });
  expect(first.data.map(entry => entry.id)).toEqual(['one', 'two']);
  const second = await readThreadListPage(cache, { ...query, cursor: first.nextCursor! }, { pageSize: 2 });
  expect(second).toEqual({ data: [thread('three')], nextCursor: null });
  expect((await cache.read(query)).data).toHaveLength(3);
  await readThreadListPage(cache, query, { pageSize: 1 });
  expect(fetch).toHaveBeenCalledTimes(2);
});

it('continues after the same row when a new chat arrives ahead of the next page', async () => {
  const fetch = vi.fn().mockResolvedValue({ data: [thread('one'), thread('two'), thread('three')], nextCursor: null });
  const cache = new ThreadListCache(fetch);
  const first = await readThreadListPage(cache, query, { pageSize: 1 });
  cache.upsert({ ...thread('new'), updatedAt: 2 }, false);
  const second = await readThreadListPage(cache, { ...query, cursor: first.nextCursor! }, { pageSize: 1 });
  expect(second.data).toEqual([thread('two')]);
  expect(fetch).toHaveBeenCalledOnce();
});

it('rejects malformed or cross-scope cursors without loading data', async () => {
  const fetch = vi.fn();
  const cache = new ThreadListCache(fetch);
  for (const cursor of ['memory-thread-list:[]', 'memory-thread-list:null',
    'memory-thread-list:{"offset":-1}', 'memory-thread-list:{"offset":1,"after":"one","scope":"other"}']) {
    await expect(readThreadListPage(cache, { ...query, cursor }, { pageSize: 1 })).rejects.toThrow();
  }
  expect(fetch).not.toHaveBeenCalled();
});

it('does not skip older chats when cursor rows are deleted or archived between pages', async () => {
  const fetch = vi.fn().mockResolvedValue({
    data: ['one', 'two', 'three', 'four'].map(thread), nextCursor: null,
  });
  const cache = new ThreadListCache(fetch);
  const first = await readThreadListPage(cache, query, { pageSize: 2 });
  cache.remove('two');
  cache.receive({ method: 'thread/archived', params: { threadId: 'one' } });
  const second = await readThreadListPage(cache, { ...query, cursor: first.nextCursor! }, { pageSize: 2 });
  expect(second).toEqual({ data: [thread('three'), thread('four')], nextCursor: null });
  expect(fetch).toHaveBeenCalledOnce();
});
