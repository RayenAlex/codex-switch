import { afterEach, expect, it, vi } from 'vitest';
import { LoungeContactSync } from '../../../../shared/lounge/contactSync';
import type { LoungeSnapshot } from '../../../../shared/lounge/types';

afterEach(() => vi.useRealTimers());

function fixture() {
  vi.useFakeTimers();
  let state: LoungeSnapshot = { status: 'connected', user: { id: 'alice', account: 'alice@test' },
    messages: [], unread: 0, policy: { moderator: false, mutedUntil: null }, historyRevision: 0,
    historyError: false, contacts: [], blocked: [], directAvailable: true, conversation: '', unreadByConversation: {} };
  const send = vi.fn((_frame: Record<string, unknown>) => true); const persist = vi.fn(); const watch = vi.fn();
  const sync = new LoungeContactSync({ snapshot: () => state, update: value => { state = { ...state, ...value }; },
    send, persist, watch, profile: user => user });
  const reply = (value: Record<string, unknown>) => sync.receive({ type: 'saved-contacts',
    id: send.mock.calls.at(-1)?.[0].id, ...value });
  return { sync, send, persist, watch, reply, snapshot: () => state };
}

it('restores cloud contacts into an empty device and preserves local pinning, previews and privacy', () => {
  const { sync, reply, snapshot, persist } = fixture();
  sync.remember({ user: { id: 'bob', account: 'bob@test', remark: 'Private note' }, direct: true,
    pinned: true, lastMessageAt: 42 });
  sync.ready(true);
  reply({ users: [{ id: 'bob', account: 'bob@test' }, { id: 'carol', account: 'carol@test' },
    { id: 'alice', account: 'alice@test' }] });
  expect(snapshot().contacts).toEqual([
    { user: { id: 'bob', account: 'bob@test', remark: 'Private note' }, direct: true, pinned: true, lastMessageAt: 42 },
    expect.objectContaining({ user: { id: 'carol', account: 'carol@test' }, direct: true }),
  ]);
  expect(persist).toHaveBeenCalledTimes(2);
  expect(snapshot().messages).toEqual([]);
  expect(snapshot().unread).toBe(0);
  expect(vi.getTimerCount()).toBe(0);
});

it('pages once at a time and refreshes after a change received during paging', async () => {
  const { sync, reply, send, snapshot, watch } = fixture();
  sync.ready(true);
  sync.receive({ type: 'saved-contacts-changed' });
  expect(send).toHaveBeenCalledTimes(1);
  reply({ users: [{ id: 'bob', account: 'bob@test' }], cursor: 'bob' });
  await vi.advanceTimersByTimeAsync(2000);
  expect(send).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: 'bob' }));
  reply({ users: [{ id: 'carol', account: 'carol@test' }] });
  await vi.advanceTimersByTimeAsync(2000);
  expect(send).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: '' }));
  reply({ users: [] });
  expect(snapshot().contacts).toHaveLength(2);
  expect(watch).toHaveBeenCalledTimes(2);
  expect(vi.getTimerCount()).toBe(0);
});

it('handles failed and late replies, retries after timeout, and cancels work on sign-out', async () => {
  const { sync, reply, send, snapshot } = fixture();
  sync.ready(false); expect(send).not.toHaveBeenCalled();
  sync.ready(true);
  sync.receive({ type: 'saved-contacts', id: 'unrelated', users: [{ id: 'bob', account: 'bob@test' }] });
  expect(snapshot().contacts).toEqual([]);
  await vi.advanceTimersByTimeAsync(10_000);
  expect(snapshot().contactsSyncError).toBe(true);
  sync.retry(); reply({ users: [{ id: 'bob', account: 'bob@test' }] });
  expect(snapshot().contactsSyncError).toBe(false);
  sync.retry(); reply({ error: true });
  expect(snapshot().contacts).toHaveLength(1);
  sync.retry(); sync.disconnect();
  reply({ users: [{ id: 'carol', account: 'carol@test' }] });
  expect(snapshot().contacts).toHaveLength(1);
  expect(vi.getTimerCount()).toBe(0);
});

it('rejects malformed pages and invalid cursors without dropping existing contacts', () => {
  const { sync, reply, snapshot } = fixture();
  sync.remember({ user: { id: 'bob', account: 'bob@test' }, direct: true });
  for (const invalid of [{ users: [{ id: 'carol' }] }, { users: [], cursor: 'loop' },
    { users: [{ id: 'carol', account: 'carol@test' }], cursor: {} }]) {
    sync.ready(true); reply(invalid);
    expect(snapshot().contactsSyncError).toBe(true);
    expect(snapshot().contacts).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
  }
});
