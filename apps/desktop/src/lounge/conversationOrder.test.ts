// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { LoungeController } from '../../../../shared/lounge/controller';
import { mergeContact, orderedDirectContacts, parseContact, type LoungeContact } from '../../../../shared/lounge/contacts';

class Socket {
  static instances: Socket[] = [];
  onopen = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose = null;
  onerror = null;
  send() {}
  close() {}
  constructor() { Socket.instances.push(this); }
  frame(value: unknown) { this.onmessage?.({ data: JSON.stringify(value) }); }
}
const self = { id: 'alice', account: 'alice@example.test' };
const user = (id: string) => ({ id, account: `${id}@example.test` });
const settle = async () => { for (let index = 0; index < 30; index++) await Promise.resolve(); };
const controllers: LoungeController[] = [];
afterEach(() => { controllers.forEach(value => value.stop()); controllers.length = 0; vi.unstubAllGlobals(); });

it('sorts private chats by message time, with pinned chats first and deterministic empty/tied chats', () => {
  const contacts = [
    { user: user('new'), direct: true, lastMessageAt: 30 },
    { user: user('empty-b'), direct: true },
    { user: user('old'), direct: true, lastMessageAt: 10, pinned: true },
    { user: user('pinned-new'), direct: true, lastMessageAt: 20, pinned: true },
    { user: user('empty-a'), direct: true }, { user: user('group-only'), direct: false },
    { user: self, direct: true, pinned: true },
  ];
  expect(orderedDirectContacts(contacts, self.id).map(value => value.user.id))
    .toEqual(['pinned-new', 'old', 'new', 'empty-a', 'empty-b']);
  expect(contacts[0].user.id).toBe('new');
  const updated = mergeContact(contacts, { user: user('old'), direct: false, lastMessageAt: 1 });
  expect(updated.at(-1)).toMatchObject({ lastMessageAt: 10, pinned: true, direct: true });
  expect(mergeContact(updated, { user: user('old'), direct: true, pinned: false }).at(-1)?.pinned).toBe(false);
  expect(parseContact({ user: user('bad'), direct: true, lastMessageAt: NaN, pinned: 'yes' }))
    .toEqual(expect.not.objectContaining({ lastMessageAt: expect.anything(), pinned: expect.anything() }));
});

it('uses incoming and outgoing message time while ignoring selection, presence, group activity and older replays', async () => {
  vi.stubGlobal('WebSocket', Socket);
  const saved = new Map<string, LoungeContact>();
  const history = { page: async () => ({ messages: [] }), save: async () => {},
    contacts: async () => [...saved.values()],
    saveContact: async (contact: LoungeContact) => { saved.set(contact.user.id, parseContact(contact)!); } };
  const make = () => {
    const controller = new LoungeController({ baseUrl: 'https://order.test', account: self.account, history,
      authorize: async () => ({ ticket: 'fixture' }) });
    controllers.push(controller); controller.start(); return controller;
  };
  const controller = make(); await settle();
  const socket = Socket.instances.at(-1)!;
  socket.frame({ type: 'ready', user: self, direct: true, receipts: true });
  const order = () => orderedDirectContacts(controller.snapshot().contacts).map(value => value.user.id);
  const message = (id: string, time: number, outgoing = false) => socket.frame({ type: 'message',
    id: `${id}-${time}`, text: 'test', images: [], sentAt: new Date(time).toISOString(),
    sender: outgoing ? self : user(id), recipient: outgoing ? user(id) : self });
  message('bob', 1000); message('carol', 2000); expect(order()).toEqual(['carol', 'bob']);
  message('bob', 3000, true); expect(order()).toEqual(['bob', 'carol']);
  message('carol', 500); controller.selectConversation(user('carol'));
  socket.frame({ type: 'contacts', contacts: [{ id: 'carol', online: true }] });
  for (let index = 0; index < 210; index++) socket.frame({ type: 'message', id: `group-${index}`,
    text: 'group', images: [], sender: user('carol'), sentAt: new Date(4000 + index).toISOString() });
  expect(order()).toEqual(['bob', 'carol']);
  controller.setPinned('carol', true); expect(order()).toEqual(['carol', 'bob']);
  await controller.searchHistory({ query: '' }); controller.stop();
  const restored = make(); await settle();
  expect(orderedDirectContacts(restored.snapshot().contacts).map(value => value.user.id)).toEqual(['carol', 'bob']);
  restored.setPinned('carol', false);
  expect(orderedDirectContacts(restored.snapshot().contacts).map(value => value.user.id)).toEqual(['bob', 'carol']);
  await restored.searchHistory({ query: '' }); expect(saved.get('carol')?.pinned).toBe(false);
  expect(saved.get('bob')?.lastMessageAt).toBe(3000);
});
