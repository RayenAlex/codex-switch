import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ChatController } from '../../../../shared/remote-chat/client/controller';
import type { ChatConnection, ConnectionEvents } from '../../../../shared/remote-chat/client/connection';
import { HISTORY_CHANGED } from '../../../../shared/remote-chat/historySync';
import type { Thread } from '../../../../shared/remote-chat/client/types';

const thread: Thread = { id: 'one', name: 'Original', preview: 'question', cwd: '/project', updatedAt: 1 };
let controller: ChatController;
let events: ConnectionEvents;
const request = vi.fn<ChatConnection['request']>();
const reads = () => request.mock.calls.filter(([, body]) => (body as { operation?: string })?.operation === 'list');

beforeEach(async () => {
  request.mockReset().mockImplementation(async (method, body) => {
    const query = body as { operation?: string; archived?: boolean; cursor?: string };
    if (method === 'connect') return [];
    if (query?.operation !== 'list') return {};
    return query.archived ? { data: [], nextCursor: null } : query.cursor
      ? { data: [{ ...thread, id: 'older' }], nextCursor: null } : { data: [thread], nextCursor: 'older' };
  });
  controller = new ChatController(callbacks => {
    events = callbacks;
    return { request: <T>(...args: Parameters<ChatConnection['request']>) => request(...args) as Promise<T>,
      start() { events.mode('relay'); events.ready(); }, stop() {} };
  });
  controller.start();
  await vi.waitFor(() => expect(controller.snapshot().ready).toBe(true));
});
afterEach(() => { controller.stop(); vi.useRealTimers(); });

it('reuses the complete list across drafts, tabs and relay/direct path changes', async () => {
  await controller.list({ more: true });
  await controller.list({ archived: true });
  await controller.list({ archived: false });
  controller.back();
  events.mode('direct');
  await controller.list({ background: true });
  expect(controller.snapshot().threads.map(entry => entry.id)).toEqual(['one', 'older']);
  expect(controller.snapshot().cursor).toBeNull();
  expect(reads()).toHaveLength(3);
});

it('updates cached archive membership after writes without reloading either tab', async () => {
  await controller.list({ archived: true });
  await controller.list({ archived: false });
  await controller.threadActions.run(thread, 'rename', 'New title');
  await controller.threadActions.run(thread, 'archive');
  expect(controller.snapshot().threads).toEqual([]);
  await controller.list({ archived: true });
  expect(controller.snapshot().threads[0].name).toBe('New title');
  await controller.threadActions.run(controller.snapshot().threads[0], 'unarchive');
  await controller.list({ archived: false });
  expect(controller.snapshot().threads[0].name).toBe('New title');
  await controller.threadActions.run(controller.snapshot().threads[0], 'delete');
  expect(controller.snapshot().threads).toEqual([]);
  expect(reads()).toHaveLength(2);
});

it('uses lightweight host notifications to update the list while preserving pagination', async () => {
  vi.useFakeTimers();
  const created = { ...thread, id: 'new', name: 'New chat' };
  events.event({ method: HISTORY_CHANGED, params: { threadId: 'new', reason: 'thread/started', thread: created } });
  events.event({ method: 'thread/name/updated', params: { threadId: 'new', threadName: 'Renamed' } });
  events.event({ method: 'turn/completed', params: { threadId: 'new',
    turn: { id: 'turn', status: 'completed', completedAt: 2, items: [] } } });
  await vi.advanceTimersByTimeAsync(1000);
  expect(controller.snapshot().threads[0]).toMatchObject({ id: 'new', name: 'Renamed', updatedAt: 2 });
  expect(controller.snapshot().cursor).toBe('older');
  expect(reads()).toHaveLength(1);
});

it('revalidates on explicit refresh and reconnect while retaining the visible list', async () => {
  await controller.list();
  expect(reads()).toHaveLength(2);
  events.mode('offline');
  expect(controller.snapshot().threads).toEqual([thread]);
  events.mode('relay');
  events.ready();
  await vi.waitFor(() => expect(controller.snapshot().ready).toBe(true));
  expect(reads()).toHaveLength(3);
});
