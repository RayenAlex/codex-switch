// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { QueueConnection } from '../../../../shared/remote-chat/client/queueConnection';
import { isMessageQueueEnabled, saveMessageQueueEnabled } from '../../../../shared/chat/messageQueueSettings';

const thread = { id: 'thread', cwd: '', preview: '', updatedAt: 1, turns: [] };
const running = { ...thread, turns: [{ id: 'live', status: 'inProgress', items: [] }] };
const input = { text: 'send now', images: ['data:image/png;base64,aW1hZ2U='],
  skills: [{ name: 'review', path: '/review' }],
  attachments: [{ kind: 'file' as const, name: 'notes.md', path: '/notes.md', data: 'aGVsbG8=' }],
  access: 'workspace-write' as const };

beforeEach(() => localStorage.clear());
afterEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

it('defaults to queuing and honors changes on the same remote connection', async () => {
  const request = vi.fn().mockResolvedValue({});
  const connection = new QueueConnection(request);
  expect(isMessageQueueEnabled()).toBe(true);
  await connection.enqueue(running, input);
  expect(request).toHaveBeenLastCalledWith({ operation: 'queueEnqueue', threadId: thread.id, ...input });
  saveMessageQueueEnabled(false);
  request.mockClear();
  expect(await connection.enqueue(running, input)).toBeNull();
  expect(request).toHaveBeenCalledExactlyOnceWith({ operation: 'steer', threadId: thread.id, turnId: 'live',
    text: input.text, images: input.images, skills: input.skills, attachments: input.attachments });
  saveMessageQueueEnabled(true);
  await connection.enqueue(running, input);
  expect(request).toHaveBeenLastCalledWith({ operation: 'queueEnqueue', threadId: thread.id, ...input });
});

it('remembers disabling the queue after reconnecting and starts idle conversations directly', async () => {
  saveMessageQueueEnabled(false);
  const request = vi.fn().mockResolvedValue({});
  const connection = new QueueConnection(request);
  connection.reset();
  await connection.enqueue(thread, input);
  expect(request.mock.calls.map(([body]) => body.operation)).toEqual(['resume', 'send']);
  expect(request).toHaveBeenLastCalledWith({ operation: 'send', threadId: thread.id, ...input });
});

it('preserves errors without enqueuing or retrying an unacknowledged immediate send', async () => {
  saveMessageQueueEnabled(false);
  const request = vi.fn().mockRejectedValue(new Error('connection lost'));
  await expect(new QueueConnection(request).enqueue(running, input)).rejects.toThrow('connection lost');
  expect(request).toHaveBeenCalledTimes(1);
  expect(request.mock.calls[0][0].operation).toBe('steer');
});

it('does not send after the connection changes during resume', async () => {
  saveMessageQueueEnabled(false);
  let finish!: (value: unknown) => void;
  const request = vi.fn().mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const connection = new QueueConnection(request);
  const send = connection.enqueue(thread, input);
  connection.reset(); finish({});
  await expect(send).rejects.toThrow();
  expect(request).toHaveBeenCalledTimes(1);
});

it('keeps queueing enabled when storage is unavailable', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('unavailable'); });
  expect(isMessageQueueEnabled()).toBe(true);
});
