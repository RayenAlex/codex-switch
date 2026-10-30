import { afterEach, expect, it, vi } from 'vitest';
import { LoungeController } from '../../../../shared/lounge/controller';
import { conversationRows } from '../../../../shared/lounge/conversationRows';
import { conversationPreviewText } from '../../../../shared/lounge/conversationPreview';

class Socket {
  static OPEN = 1;
  static instances: Socket[] = [];
  readyState = 1;
  bufferedAmount = 0;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  send = vi.fn();
  close = vi.fn();
  constructor() { Socket.instances.push(this); }
  frame(value: object) { this.onmessage?.({ data: JSON.stringify(value) }); }
}
const settle = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); Socket.instances = []; });

it('completes native group sending on server acceptance without a full message echo', async () => {
  vi.stubGlobal('WebSocket', Socket);
  const controller = new LoungeController({ baseUrl: 'https://chat.test', authorize: async () => ({ ticket: 'test' }) },
    { isVisible: () => true, randomId: () => 'native-group', subscribe: () => () => {} });
  controller.start(); await settle();
  try {
    const socket = Socket.instances[0]; socket.onopen?.();
    expect(JSON.parse(socket.send.mock.calls[0][0]).groupAcks).toBe(true);
    socket.frame({ type: 'ready', user: { id: 'me', account: 'me@test' } });
    const sent = controller.send({ text: 'native group', images: [] });
    expect(controller.snapshot().messages).toEqual([]);
    socket.frame({ type: 'accepted', id: 'native-group', sentAt: new Date().toISOString() });
    await sent;
    expect(controller.snapshot().messages).toEqual([expect.objectContaining({ text: 'native group' })]);
    expect(controller.snapshot().unread).toBe(0);
  } finally { controller.stop(); }
});

it('runs without a DOM, reconnects on foreground, and clears only visible messages and session data', async () => {
  vi.useFakeTimers(); vi.stubGlobal('WebSocket', Socket);
  expect(typeof document).toBe('undefined');
  let active = true;
  let wake = () => {};
  const cleanup = vi.fn();
  const controller = new LoungeController({ baseUrl: 'https://chat.test', authorize: async () => ({ ticket: 'test' }) },
    { isVisible: () => active, randomId: () => 'native-id', subscribe: listener => { wake = listener; return cleanup; } });
  controller.start(); await settle();
  const socket = Socket.instances[0];
  socket.frame({ type: 'ready', user: { id: 'me', account: 'me@test' } });
  const incoming = (id: string) => socket.frame({ type: 'message', id, text: id, images: [],
    sender: { id: 'other', account: 'other@test' }, sentAt: new Date().toISOString() });
  incoming('background-page'); expect(controller.snapshot().unread).toBe(1);
  controller.setViewing(true); expect(controller.snapshot().unread).toBe(0);
  active = false; wake(); incoming('background-app'); expect(controller.snapshot().unread).toBe(1);
  active = true; wake(); expect(controller.snapshot().unread).toBe(0);
  const pending = controller.send({ text: 'keep draft on failure', images: [] }).catch(error => error.message);
  expect(JSON.parse(socket.send.mock.calls.at(-1)![0]).id).toBe('native-id');
  socket.onclose?.(); expect(await pending).toBe('client.lounge.sendFailed');
  wake(); await settle(); expect(Socket.instances).toHaveLength(2);
  controller.stop(); expect(cleanup).toHaveBeenCalledOnce();
  expect(controller.snapshot().messages).toEqual([]); expect(controller.snapshot().unread).toBe(0);
});

it('previews the latest unread incoming text, then retains the last message after reading', async () => {
  vi.stubGlobal('WebSocket', Socket);
  const self = { id: 'me', account: 'me@test' };
  const peer = { id: 'other', account: 'other@test' };
  const controller = new LoungeController({ baseUrl: 'https://chat.test', authorize: async () => ({ ticket: 'test' }) },
    { isVisible: () => true, randomId: () => 'native-id', subscribe: () => () => {} });
  controller.start(); await settle();
  const socket = Socket.instances[0];
  socket.frame({ type: 'ready', user: self });
  const receive = (text: string, own = false) => socket.frame({ type: 'message', id: text, text, images: [],
    sender: own ? self : peer, recipient: own ? peer : self, sentAt: new Date().toISOString() });
  const row = (draft = '') => conversationRows({ state: controller.snapshot(), controller,
    drafts: { other: { text: draft, images: [] } } }).find(item => item.id === 'other')!;
  try {
    receive('older unread'); receive('最新文字\n第二行\t继续');
    expect(row().unread).toBe(2);
    expect(conversationPreviewText(row('unsent draft'))).toBe('最新文字 第二行 继续');
    receive('own outgoing', true);
    expect(conversationPreviewText(row())).toBe('最新文字 第二行 继续');
    receive('latest unread');
    controller.selectConversation(peer); controller.setViewing(true);
    expect(row().unread).toBe(0);
    expect(conversationPreviewText(row())).toBe('latest unread');
    receive('own reply', true);
    expect(conversationPreviewText(row())).toBe('own reply');
    controller.setViewing(false);
    expect(conversationPreviewText(row())).toBe('own reply');
    expect(conversationPreviewText(row('draft retained'))).toContain('draft retained');
  } finally { controller.stop(); }
});
