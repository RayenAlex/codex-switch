import { afterEach, expect, it, vi } from 'vitest';
import { LoungeAccountLookup, recentSpeakers } from '../../../../shared/lounge/accountLookup';
import type { LoungeMessage } from '../../../../shared/lounge/types';

afterEach(() => { vi.useRealTimers(); });

function fixture() {
  const lookup = new LoungeAccountLookup();
  const send = vi.fn();
  const abort = new AbortController();
  const find = (id = 'request') => lookup.find({ socket: { send } as unknown as WebSocket,
    id, query: ' bob@example.test ', signal: abort.signal });
  return { lookup, send, abort, find };
}

it('correlates exact lookup replies and ignores unsolicited accounts', async () => {
  const { lookup, send, find } = fixture();
  const pending = find();
  expect(JSON.parse(send.mock.calls[0][0])).toEqual({ type: 'lookup-account',
    id: 'request', query: 'bob@example.test' });
  const user = { id: 'bob', account: 'bob@example.test' };
  expect(lookup.receive({ type: 'account-found', id: 'other', user })).toBe(false);
  expect(lookup.receive({ type: 'account-found', id: 'request', user })).toBe(true);
  await expect(pending).resolves.toEqual(user);
});

it('returns known errors and sanitizes unexpected errors and malformed users', async () => {
  const { lookup, find } = fixture();
  for (const frame of [
    { type: 'rejected', code: 'client.lounge.accountLookupAmbiguous' },
    { type: 'rejected', code: 'internal database error' },
    { type: 'account-found', user: { id: 'bob' } },
  ]) {
    const result = find().catch((error: Error) => error.message);
    lookup.receive({ id: 'request', ...frame });
    expect(await result).toBe(frame.code === 'client.lounge.accountLookupAmbiguous'
      ? frame.code : 'client.lounge.accountLookupFailed');
  }
});

it('clears pending requests on cancel, disconnect and timeout; late replies are ignored', async () => {
  vi.useFakeTimers();
  for (const reason of ['cancel', 'disconnect', 'timeout']) {
    const { lookup, find, abort } = fixture();
    const result = find().catch((error: Error) => error.message);
    if (reason === 'cancel') abort.abort();
    else if (reason === 'disconnect') lookup.disconnect();
    else await vi.advanceTimersByTimeAsync(10_000);
    expect(await result).toBe('client.lounge.accountLookupFailed');
    expect(lookup.receive({ type: 'account-found', id: 'request',
      user: { id: 'late', account: 'late@test' } })).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  }
});

it('lists actual recent speakers once, newest first, excluding self', () => {
  const messages = ['bob', 'carol', 'bob', 'self'].map((id, index): LoungeMessage => ({
    type: 'message', id: String(index), sender: { id, account: `${id}@example.test` },
    text: 'hello', images: [], sentAt: new Date(index).toISOString(),
  }));
  expect(recentSpeakers(messages, 'self').map(user => user.id)).toEqual(['bob', 'carol']);
  expect(recentSpeakers(messages, 'self', 1).map(user => user.id)).toEqual(['bob']);
  expect(recentSpeakers(messages, 'self', 2)).toEqual([]);
  expect(recentSpeakers(messages.slice(0, 1), 'self').map(user => user.id)).toEqual(['bob']);
});
